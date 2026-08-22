## 2026-08-22 — Dört saniyelik lojistik rota fırtınası doğrulandı
- **Type:** Confirmed
- **Source:** `RCA.md` — Dört saniyelik lojistik rota fırtınası
- **What happened:** Hikâye simülasyonunda her 4 saniyede çalışan lojistik katmanı ana iş parçacığında binlerce tekrarlı rota araması yapıyor.
- **Evidence:** Seed 2032, 60 saniye/0,25 adım koşusunda p95 1.374,413 ms ve max 3.844,119 ms; 12 saniyede 7.565 altyapı rota araması. Lojistik kapalı A/B max 101,7 ms.
- **Implication for future audits:** Taşıt hareketiyle eşzamanlı donmayı sprite çizimine bağlama; önce 4 saniyelik `storyTradeLogisticsTick` ve rota çağrı bütçesini ölç.

## 2026-08-22 — Taşıt overlay ve statik harita çizimi kök neden değil
- **Type:** Refuted
- **Source:** `RCA.md` — Taşıt sprite'ları ve harita yeniden çizimi donuyor
- **What happened:** Taşıt overlay'i ve kamera render'ı ayrı ölçüldü; saniyelik donma renderer olmadan başsız simülasyonda da tekrarlandı.
- **Evidence:** Taşıt overlay p95 yaklaşık 0,2 ms; kamera/render 15–19 ms; başsız simülasyon max 3.844,119 ms.
- **Implication for future audits:** Yeni render kanıtı olmadıkça saniyelik periyodik donmayı harita sprite/cache katmanına yeniden atfetme.

## 2026-08-22 — LLM bellek kullanımı donmanın gerekli nedeni değil
- **Type:** Refuted
- **Source:** `RCA.md` — LLM/GPU/RAM baskısı
- **What happened:** LLM ve Electron olmadan çalışan Node simülasyonu aynı 4 saniyelik uzun adımları üretti.
- **Evidence:** Başsız 60 saniyelik koşu p95 1.374,413 ms, max 3.844,119 ms.
- **Implication for future audits:** LLM/bellek baskısını yalnız şiddet artırıcı olarak değerlendir; lojistik uzun-task'ı kaldırılmadan onu kök neden sayma.

## 2026-08-22 — Simülasyon performansı testlerde görünmüyor
- **Type:** Confirmed
- **Source:** `RCA.md` — Detection failure
- **What happened:** Maptest dünya zamanını durdurup yalnız render/overlay ölçüyor; telemetry alt sistem sürelerini kaydetmiyor ve gerçek ölçekli adım bütçesi testi yok.
- **Evidence:** `electron/main.js:372`, `electron/main.js:435-465`, `js/StoryTelemetry.js:259-285`.
- **Implication for future audits:** Canlı simülasyon açık performans kapısı ve adlandırılmış görev süreleri eklenene kadar render testlerinin hikâye modu akıcılığını kanıtladığını kabul etme.

## 2026-08-22 — Belge ağacı kanonik sahiplik alanlarına ayrıldı
- **Type:** Executed
- **Source:** `plans/documentation-layout.md`
- **What happened:** Kök ve düz `docs/` yığını; ürün, hikâye, savaş AI, UX ve operasyon sahiplik alanlarına ayrıldı. Kanonik giriş noktaları ve yaşayan belge üstverisi eklendi; mislabeled ikili dosya arşivlendi.
- **Evidence:** `docs/README.md`, `docs/ARCHITECTURE.md`; 123/123 yerel Markdown bağlantısı doğrulandı; kökte yalnız `README.md`, `LEDGER.md`, `RCA.md` kaldı. Uygulama commitleri: `3362bcd`–`eded71b`.
- **Implication for future audits:** Belge keşfine `docs/README.md` üzerinden başla; eski kök veya düz `docs/` yollarını kanonik kabul etme. Tam test paketi `tests/story-conversation-semantic-model.test.js` içindeki önceden var olan `MODEL_LOADING` / `NOT_REQUIRED` beklenti uyuşmazlığı çözülene kadar bu plan `In Progress` kalır.

## 2026-08-22 — Semantik model kuyruğunu NOT_REQUIRED kısa devresi engelliyor
- **Type:** Confirmed
- **Source:** `RCA.md` — Semantik model yaşam döngüsü
- **What happened:** Deterministik UNKNOWN açıklaması yanıtı `NOT_REQUIRED` işaretliyor; açılış ve takip çağıranları bu etiketi model gereksinimi kararı sanıp semantik kuyruk fonksiyonunu hiç çağırmıyor.
- **Evidence:** Seed 38103 ile iki yeniden üretimde `UNKNOWN`, güven 1100 ve `CLARIFY_UNKNOWN_WITHOUT_FAKE_CONTINUITY` yanıtı gözlendi; `npm run story:conversation-semantic-model-test` 2/2 kez `NOT_REQUIRED` aldı.
- **Implication for future audits:** Semantik model başlamadığında önce LLM/GPU hazır oluşunu değil, `StoryConversationUnderstanding.js` çağrı yerlerindeki durum kısa devresini denetle.

## 2026-08-22 — Özellik bayrağı ve LLM köprüsü semantik test hatasının nedeni değil
- **Type:** Refuted
- **Source:** `RCA.md` — Semantik model yaşam döngüsü
- **What happened:** Kampanya açık semantik model bayrağı ve hazır LLM test çiftiyle çalışmasına rağmen karar zinciri özellik ve köprü kontrollerine ulaşmadan kesildi.
- **Evidence:** Açılış yanıtı model kuyruğu çağrılmadan `NOT_REQUIRED`; üretim isteği oluşmadı.
- **Implication for future audits:** Aynı belirti için köprü veya GPU teşhisine ancak kuyruk fonksiyonunun gerçekten çağrıldığı kanıtlandıktan sonra geç.
