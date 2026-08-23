# RCA — Varış terminali kuyruğu geçerli sevkiyatı rota dışı gösteriyor

## 1) Incident Summary

- **Belirti:** Tam hikâye testi seed 2032 / 900 saniyelik dünyada `tradeValidation.ok=false` döndürüyor.
- **Kapsam:** 7 canlı fiziksel sevkiyat `INVALID_SHIPMENT_LEG` üretiyor; piyasa defteri geçerli ve ağ hash'i güncel.
- **Etkisi:** Sağlıklı çalışan uzun dünya testi başarısız oluyor; dokümantasyon tertip planı Landed durumuna geçirilemiyor.
- **Yeniden üretim:** `runStorySimulation({ seed: 2032, seconds: 900 })` — 197 sözleşme, 117 açık sipariş, 335 aktif sevkiyat, 7 issue.

## 2) Evidence

- Issue'ların tamamı `INVALID_SHIPMENT_LEG`; başka trade veya market issue yok.
- `storyTransportAdvanceShipment`, son fiziksel adım tamamlandığında:
  - `shipment.legIndex = shipment.corridorIds.length`
  - `shipment.currentRegionId = shipment.targetRegionId`
  - `agent.state = 'QUEUED'`
  yapıyor.
- Aynı fonksiyon sonraki tickte `stepIndex >= route.steps.length` ise terminalden `UNLOAD` penceresi istiyor. Slot yoksa ajan meşru olarak `QUEUED` kalıyor.
- `storyTradeValidate`, rota sonundaki canlı v2 sevkiyatı yalnız ajan `UNLOADING` ise kabul ediyor. Varış boşaltma kuyruğundaki `QUEUED` state sözleşmede yok.
- `storyTransportShipmentValidate` aynı canlı `QUEUED` ajanı geçerli kabul ediyor. İki validator birbiriyle çelişiyor.

## 3) Timeline

| Zaman | Olay | Kaynak | Önemi |
|---|---|---|---|
| 2026-08-20 | Terminal slotları, kuyruk ve fiziksel transport agent eklendi | `6ece5a5` | Varışta `legIndex=end + QUEUED` meşru yaşam döngüsü oldu. |
| 2026-08-23 | Ağ hash ve terminal status eşleşmeleri düzeltildi | `0fb0f87` öncesi zincir | Erken dönen iki hata kalkınca geç-zaman rota doğrulama çelişkisi görünür oldu. |
| 2026-08-23 | Tam test 900 saniyede trade invariantını reddetti | `npm test` | 180 saniyelik kısa koşuda terminal yoğunluğu bu katmanı üretmedi. |
| 2026-08-23 | Tek süreç 900 saniye ile issue sınıfı izole edildi | Seed 2032 tanı koşusu | 7/7 issue yalnız varış kuyruğundaki canlı leg sözleşmesine daraldı. |

## 4) Hypotheses (ranked)

### H1 — Trade validator varış boşaltma kuyruğunu tanımıyor

- **If true, we would also see:** `legIndex === corridorIds.length`, hedef bölge doğru, ajan canlı `QUEUED`; transport validator geçerken trade leg validator başarısız olur.
- **Discriminating test:** Son adım geçişi ve terminal admission kodunu `physicalUnloadingAtDestination` koşuluyla karşılaştırmak.
- **Status:** Confirmed. Üretici açıkça varışta `QUEUED` yazıyor; trade validator yalnız `UNLOADING` kabul ediyor.

### H2 — Rota yeniden yönlendirmesi legIndex'i eski rotada bırakıyor

- **If true, we would also see:** `legIndex > corridorIds.length`, hedef/current uyuşmazlığı veya route replacement sonrası fiziksel adım sayısı çelişkisi.
- **Discriminating test:** Issue koşulu ile replace-route atomik alan güncellemelerini incelemek.
- **Status:** Refuted. Issue mesajı rota sonuna eşit canlı kayıt deseninde oluşuyor; üretici bu deseni varış kuyruğu için doğrudan kuruyor.

### H3 — Dinamik altyapı revizyonu aktif shipment rotalarını bozuyor

- **If true, we would also see:** Eksik koridor/segment, ağ hash veya transport agent issue'ları.
- **Discriminating test:** Aynı 900 saniyelik doğrulamadaki issue dağılımını incelemek.
- **Status:** Refuted. Ağ hash güncel; market geçerli; issue listesi yalnız `INVALID_SHIPMENT_LEG`.

### H4 — Terminal yoğunluğu sevkiyatları gerçekten kilitliyor

- **If true, we would also see:** Kuyruk state'i yaşam döngüsünde ilerlemeyen, sürekli büyüyen ve terminal admission alamayan kayıtlar.
- **Discriminating test:** Terminal request kuyruğu/slot kodu ile state geçişini incelemek.
- **Status:** Refuted as root cause. Kuyruk bekleme tasarlanmış geri basınçtır; her tick yeniden admission dener. Hata ilerleme değil, bu geçerli ara durumu reddeden validator sözleşmesidir.

## 5) Mechanism

1. Fiziksel ajan son rota adımını tamamlar.
2. Sevkiyat makro olarak hedef bölgeye ulaşır; `legIndex` rota uzunluğuna eşitlenir.
3. Boşaltma başlamadan önce ajan terminal slotu için `QUEUED` durumuna alınır.
4. Slot doluysa `storyTransportTerminalRequest` ajanı kuyrukta tutar; sevkiyat hâlâ `IN_TRANSIT` ve geçerlidir.
5. Transport validator canlı `QUEUED` durumunu kabul eder.
6. Trade leg validator yalnız `UNLOADING` durumunu istisna sayar ve aynı kaydı `INVALID_SHIPMENT_LEG` diye reddeder.

- **Root cause:** Trade ve transport validatorları varış terminali yaşam döngüsü için ortak invariant kullanmıyor; geçerli `QUEUED -> UNLOADING` ara durumu trade katmanında eksik.
- **Contributing factor:** 180 saniyelik kısa dikey testler terminal slot doygunluğunu üretmedi.
- **Detection failure:** Birim testleri kuyruk hareketini ve teslimatı ayrı ayrı ölçüyor, fakat rota sonundaki kuyrukta bekleme anında bütün trade ledger doğrulamasını çağırmıyor.

## 6) Remediation Options

### Fix

- **Title:** Rota sonundaki v2 boşaltma kuyruğunu geçerli saymak
- **Category:** Fix
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** `js/StoryTrade.js`, `storyTradeValidate`
- **Recommended fix:** Rota sonundaki canlı fiziksel sevkiyat istisnasını yalnız `UNLOADING` yerine doğrulanabilir varış terminali aşamasına genişlet: `QUEUED` için `stepIndex === physicalRoute.steps.length`, hedef bölge eşleşmesi ve transfer hedefinin olmaması; `UNLOADING` mevcut biçimde geçerli kalsın.
- **Tradeoffs / Risks:** Genel `QUEUED` kabul edilmemeli; yükleme veya transfer kuyruğunu yanlışlıkla varış saymamak için son-step ve hedef invariantları zorunlu.

### Prevention

- **Title:** Varış terminali doygunluğu altında ledger invariant testi
- **Category:** Prevention
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `tests/story-transport-agents.test.js` veya yeni dar trade lifecycle testi
- **Recommended fix:** Tek slotlu terminalde ikinci sevkiyatı rota sonunda `QUEUED` bırakıp `storyTradeValidate.ok=true` olduğunu; sahte rota-sonu `QUEUED` kaydının reddedildiğini doğrula.
- **Tradeoffs / Risks:** Küçük test maliyeti; geç-zaman dünya testine göre çok daha hızlı ve ayırt edici.

## 7) Verification Plan

- Dar test: varışta `QUEUED` + son fiziksel step + doğru hedef geçerli.
- Negatif test: yükleme/transfer kuyruğu veya eksik son-step varış istisnasından yararlanamıyor.
- Mevcut transport agent, kara, demir, deniz ve multimodal testleri geçmeli.
- Seed 2032 / 900 saniyelik doğrudan koşu `tradeValidation.ok=true` ve `marketValidation.ok=true` vermeli.
- Son kapı: `npm test` sıfır koduyla tamamlanmalı.
