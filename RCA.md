# RCA — Geri alınmış siyasi olay sohbet adaptörü birleşik testte hâlâ zorunlu

## 1) Verdict

- **Root cause:** conversationUnderstandingProbe içindeki Faz 38.5 siyasi kriz assertion bloğu, runtime’dan geri alınmış deneysel event-counsel/kabul/hafıza adaptörünü hâlâ canlı özellik gibi zorunlu tutuyor.
- **Confidence:** Confirmed.
- Bu blok güncel doğrudan NLU laboratuvarı değildir; kanonik durum belgesinin bayat birleşik probe diye işaretlediği eski canlı entegrasyon kabulüdür.

## 2) Failure Definition

- Beklenen: Onaylanan temizlik eski özel canlı-NLU/olay assertionlarını kaldırmalı; doğrudan senaryo laboratuvarları ve 10 güvenli fallback testi kalmalı.
- Gerçek: Runtime’da EVENT_COUNSEL_RESPONSE, event-open düğmesi ve sourceEventAnchor uygulaması yokken 33 ayrı olay/kabul/hafıza sonucu true zorunlu tutuluyor.
- Etki: Güvenli fallback ve doğrudan laboratuvar testleri geçse bile paket hiç sevk edilmemiş özelliği arıyor.
- Blast radius: tests/story-world.test.js içindeki phase385EventConversation assertion grubu; harness ölçümü ve ana plan borcu korunabilir.

## 3) Evidence

- Depo genelinde EVENT_COUNSEL_RESPONSE ve data-conversation-event-open yalnız harness/testte geçiyor.
- Runtime’da sourceEventAnchor yalnız şema migrasyonu ve null constructor alanı olarak mevcut.
- Git -S araması StoryConversationUnderstanding/Talks geçmişinde bu sembollerin sevk edilmiş uygulamasını bulmadı.
- Kanonik HIKAYE_MODU_UYGULAMA_DURUMU Faz 38.5 satırı olay çıpalı konuşmayı açık borç sayıyor.
- Aynı belge eski birleşik conversationUnderstandingProbeun geri alınan olay-kabul API’lerini taşıdığını ve ayrıştırılması gerektiğini açıkça yazıyor.

## 4) Hypotheses

1. **Bayat spekülatif assertion bloğu kaldı.** Supported.
2. **Çalışan özellik yanlışlıkla son değişiklikte silindi.** Refuted: Git sembol geçmişinde sevk edilmiş uygulama yok; kanonik durum partial/açık borç diyor.
3. **Yalnız düğme selectorü değişti.** Refuted: event counsel response, anchor çözümü, karar ve hafıza API’lerinin tamamı yok.
4. **Doğrudan 10 senaryo laboratuvarı buna bağlı.** Refuted: senaryo katalog/branch/truth/determinism/fallback probları ayrı çalışıyor.

## 5) Remediation

- phase385EventConversation eski canlı assertion grubunu test kapısından kaldır.
- Harness ölçümünü tarihsel/non-gating kanıt olarak şimdilik koru; yeni özellik geliştirildiğinde ayrı, küçük ve sevk edilmiş API’ye bağlı prob kurulmalı.
- Kanonik plan ve durum belgesindeki olay-bağlı konuşma borcunu kapatma.
- Doğrudan senaryo laboratuvarları ve 10 güvenli fallback assertionlarını aynen koru.

## 6) Verification Plan

- tests/story-world.test.js içinde phase385EventConversation zorunlu assertionı kalmamalı.
- On doğrudan lab senaryosu ve on fallback senaryosu çalışmalı.
- Sıralı assertion katmanı bir sonraki gerçek regresyona ilerlemeli.
- Tam npm test paketi geçmeli.