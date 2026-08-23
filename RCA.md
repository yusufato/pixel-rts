# RCA — Yükleme-anı taşıma göç teşhisi deterministik dünya hashine sızıyor

## 1) Verdict

- **Root cause:** `probeSchedulerRegistry` tam kayıt JSON'unu deterministik dünya görünümü olarak karşılaştırıyor; `storyLoad()` ise yalnız yüklenen süreçte `tradeLogistics.diagnostics.transportMigration` alanını yeniden üretiyor.
- **Confidence:** Confirmed.
- Dünya/ekonomi durumu ayrışmıyor; fark yalnız yükleme sırasında üretilen, operasyonel olmayan tanı makbuzudur.

## 2) Failure Definition

- Beklenen: Kesintisiz ve kayıt-yükleme-devam yollarının kanonik simülasyon durumu aynı hash'i üretmeli.
- Gerçek: Yüklenen yol 61 ertelenmiş eski sevkiyat için `LEGACY_PHYSICAL_ROUTE_UNAVAILABLE` teşhisi taşıyor; kesintisiz yol bu yükleme-anı alanını taşımıyor.
- Etki: Görev zamanlayıcısı devamlılık kapısı, aynı dünya durumunu farklı sanıyor.
- Blast radius: Test harness içindeki deterministik kayıt görünümü; üretim simülasyonu ve ticaret korunum hesabı etkilenmiyor.

## 3) Evidence

- Assertion farkı yalnız `$.tradeLogistics.diagnostics.transportMigration` yolunu gösteriyor.
- `storyLoad()` sırasındaki `storyTransportMigrateLegacyShipments()` sonucu `ledger.diagnostics.transportMigration` alanına yazılıyor.
- `storyTradeForSave()` defteri teşhislerle birlikte klonladığı için alan sonraki kayda giriyor.
- Ticaret kalıcılık probları `tradeOperationalPersistenceView()` içinde `diagnostics` alanını zaten operasyonel eşitlikten çıkarıyor.
- Kesintisiz ve devam eden yolların göç teşhisi dışındaki fark listesi boş.

## 4) Hypotheses

1. **Yükleme-anı teşhisi kanonik dünya hashine yanlışlıkla dahil edildi.** Supported.
2. **Görev zamanlayıcısı veya RNG yükleme sonrasında ayrıştı.** Refuted: raporlanan tek fark tanı alanı; zamanlayıcı ve dünya alanlarında fark yok.
3. **61 sevkiyat gerçekten kayboldu veya değişti.** Refuted: göç sonucu `migrated: 0`, `deferred: 61`; operasyonel ticaret görünümü teşhis hariç eşitliği ayrı kapılıyor.
4. **Üretim kaydı bütün `diagnostics` alanlarını silmeli.** Refuted for this fix: bazı teşhisler yükleme/onarım görünürlüğü için bilinçli saklanıyor; kapsam yalnız deterministik karşılaştırmadaki süreç-yerel göç makbuzudur.

## 5) Remediation

- `storyDeterministicSaveSnapshot()` içinde yalnız `tradeLogistics.diagnostics.transportMigration` alanını karşılaştırma görünümünden çıkar.
- Ticaret defterinin operasyonel alanlarını, diğer teşhislerini ve üretim save/load davranışını değiştirme.

## 6) Verification Plan

- Korunmuş sonuç setiyle sıralı assertion koşusu devamlılık eşitliğini geçmeli.
- Ticaretin özel migration ve operasyonel kalıcılık assertionları korunmalı.
- Tam `npm test -- --keep-results` paketi yeşil olmalı.
