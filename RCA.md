# RCA — Warp testi düz projeksiyon tek-blit hızlı yolunu şerit döngüsü sanıyor

## 1) Verdict

- **Root cause:** Faz 14.5 assertionları her geçerli warp örneğinin `plan.rows × 2` drawImage çağrısı yapacağını varsayıyor. Daha sonra eklenen uzak/düz projeksiyon hızlı yolu `storyPP()≈0` iken her katmanı tek drawImage ile çiziyor; şerit planı yalnız perspektifli yakın görünümde kullanılıyor.
- **Confidence:** Confirmed.
- Güncel probda uzak 720/1080/1440 ve fixed-1080 iki katman toplam `2` çağrı; yakın perspektif örneği `270×2=540` çağrı kullanıyor. Tersinim ve ölçek hata kapıları sıfır/bütçe içidir.

## 2) Failure Definition

- Beklenen: Test etkin çizim yolunun yayınladığı `lastFrame.drawCallsPerLayer` değerini doğrulamalı; şerit cache kapılarını yalnız şerit yolu gerçekten kullanıldığında uygulamalı.
- Gerçek: Düz görünüm tek-blit olmasına rağmen test 180/216/206 şerit planını fiilen çizilmiş kabul ediyor ve cache hit zorunlu tutuyor.
- Etki: Yüzlerce gereksiz drawImage çağrısını kaldıran optimizasyon regresyon sayılıyor.
- Blast radius: Warp assertion döngüsündeki draw-call ve plan-cache beklentileri ile iki açıklama metni.

## 3) Evidence

- Git blame `562169f` değişikliğinin tam uzak görünümde perspektif olmadığında şeritlerin gereksiz çağrı ve dikiş izi ürettiği için tek blit eklediğini gösteriyor.
- Yeni hedefli prob uzak örneklerde `drawCalls=2`, `lastFrame.drawCallsPerLayer=1`, ölçek ve round-trip hata `0` veriyor.
- Yakın örnek `drawCalls=540`, `lastFrame.drawCallsPerLayer=270`, cache `1 miss / 2 hit`, maksimum ölçek hatası `%0,2101`, round-trip `0` veriyor.
- `storyWarpPlan()` yine fallback planı ve adaptif band karşılaştırması için ölçülüyor; fakat düz hızlı yolun gerçek çağrı sayısı değildir.

## 4) Hypotheses

1. **Test tek-blit optimizasyonundan önce kalmış.** Supported.
2. **Renderer iki katmandan birini çizmiyor.** Refuted: `first=true`, `second=true`, toplam iki çağrı ve katman başına bir çağrı yayınlanıyor.
3. **Yakın perspektif şerit cache'i bozuldu.** Refuted: 270 satır, iki katman 540 çağrı, bir miss ve en az bir hit korunuyor.
4. **Plan satır ölçümleri tamamen silinmeli.** Refuted: legacy/perspektif fallback band ve %40 adaptif azaltım sözleşmesini hâlâ doğruluyor.

## 5) Remediation

- Gerçek çağrı sayısını `lastFrame.drawCallsPerLayer × 2` ile doğrula.
- `drawCallsPerLayer===1` için tek-blit kapısı koy; cache-hit zorunluluğunu uygulama.
- Şerit yolu için `drawCallsPerLayer===rows`, bir miss ve en az bir hit kapılarını koru.
- 216/360 satır ve %40 azaltım mesajlarını gerçek düz-view çağrısı değil `perspektif fallback planı` olarak adlandır.

## 6) Verification Plan

- Uzak/düz örneklerde iki katman toplam iki drawImage çağrısı doğrulanmalı.
- Yakın perspektifte satır-başı çizim ve ortak plan cache'i geçmeli.
- Ölçek hatası <%1, round-trip <1e-8, kaynak reddi ve A/B dünya nötrlüğü korunmalı.
- Sıralı assertion ve tam paket geçmeli.