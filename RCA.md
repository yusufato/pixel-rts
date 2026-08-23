# RCA — Yükleme teşhisi kalıcı ticaret durumu sanılıyor

## Verdict

- **Root cause:** Ticaret kalıcılık probu tüm defteri ham JSON eşitliğiyle karşılaştırıyor. Kayıt yükleyicisi yalnız çalışma zamanı teşhisi olan `diagnostics.transportMigration` alanını eklediği için operasyonel durum birebir korunmasına rağmen `exactLedger=false` oluyor.
- **Confidence:** Confirmed.
- **Impact:** 88/88 simülasyon görevi ve ticaret doğrulamaları geçse bile son kabul kapısı yanlış negatif veriyor; gerçek kayıt kaybıyla zararsız yükleme teşhisi ayırt edilemiyor.

## Evidence

- Kaydedilen ve geri yüklenen defterlerin alan düzeyi farkında tek kayıt `$.diagnostics.transportMigration`.
- Geri yüklenen değer `{ ok: true, migrated: 0, deferred: 0, issues: [] }`; hiçbir göç veya onarım yapılmamış.
- Sözleşmeler, siparişler, sevkiyatlar, rota adımları, kapasite penceresi, toplamlar ve bütün kimlik/sıraçlar eşit.
- `restored.validation.ok=true` ve `regionalUnchanged=true`.

## Ranked Hypotheses

1. **Çalışma zamanı göç teşhisi ham eşitliği bozuyor — Confirmed.** Tek fark `diagnostics.transportMigration`.
2. **Sipariş veya sevkiyat kayboluyor — Refuted.** Beş sipariş ve dört teslim edilmiş sevkiyat bütün alanlarıyla korunuyor.
3. **Fiziksel rota veya kapasite penceresi değişiyor — Refuted.** Koridor/segment adımları, ajan ilerlemesi ve kapasite penceresi eşit.
4. **Yükleme bölgesel stoğu yeniden borçlandırıyor — Refuted.** `regionalUnchanged=true`.

## Remediation

- Kalıcılık eşitliğini yükleme anında üretilen `diagnostics` zarfından bağımsız, kalıcı operasyonel defter görünümü üzerinde yap.
- Teşhis doğruluğunu ayrı assertion ile koru; operasyonel veri eşitliği iddiasını teşhis metadatasına bağlama.
- Test mesajını sipariş, rota, ilerleme, kapasite ve toplamların korunduğunu açıkça belirtecek biçimde daralt.

## Verification

- Korunan 88 görev sonucu üzerinde bütün assertionlar geçmeli.
- Hedefli ticaret probunda `validation.ok`, operasyonel eşitlik ve `regionalUnchanged` birlikte doğru olmalı.
- Son tam `npm test` sıfır koduyla tamamlanmalı.
