# RCA — Mevsim çipi dünya dengesi metriklerini görünmez kılıyor

## 1) Verdict

- **Root cause:** Üst çubuktaki eski çağ çipi mevsim çipine dönüştürülürken yeni `storySeasonTooltip()` yalnız çağ adı ve açıklamasını ekledi; mevcut `storyWorldStateTooltip()` içindeki savaş, refah, çalkantı, oynaklık ve teknoloji metriklerini yeniden kullanmadı.
- **Confidence:** Confirmed.
- Bu bir bayat test değildir: oyuncunun sohbetten çıkarılan dünya verisine üst çubuk balonundan erişebilmesi kabulü hâlâ geçerlidir.

## 2) Failure Definition

- Beklenen: Mevsim çipi, mevsim bilgisinin yanında dünya dengesi adı, açıklaması ve karar vermeye yarayan ölçülebilir dünya metriklerini göstermeli.
- Gerçek: Balonda `KIŞ`, takvim, mevsim açıklaması, `SOĞUK DENGE` ve anlatı açıklaması var; `Savaş` ve `Refah` dahil ölçümler yok.
- Etki: Oyuncu çağ etiketinin yerini alan mevsim çipinden dünya hâlinin sayısal nedenlerini okuyamıyor.
- Blast radius: `js/StoryUI.js` içindeki `storySeasonTooltip()` ve üst çubuk tooltip kabul testi.

## 3) Evidence

- Assertion çıktısı balonda mevsim ve çağ anlatısını gösteriyor fakat `/Savaş.*Refah/s` eşleşmiyor.
- `storyWorldStateTooltip()` hâlâ savaş, refah, çalkantı, oynaklık, teknoloji ve çağ süresini üretiyor.
- Git blame, mevsim çipinin `54210ef` ile eklendiğini; eski dünya durumu tooltip fonksiyonunun daha önce var olduğunu gösteriyor.
- Yeni fonksiyon mevcut ayrıntı üreticisini çağırmak yerine çağ adı/açıklamasını ikinci kez elle kuruyor.

## 4) Hypotheses

1. **Mevsim geçişinde dünya metriği birleştirmesi unutuldu.** Supported.
2. **Test eski çağ çipini zorunlu tutuyor.** Refuted: test çip etiketini değil balondaki karar verisini doğruluyor; çip artık mevsim olabilir.
3. **Metrikler runtime’da üretilemiyor.** Refuted: `storyWorldStateTooltip()` ve `STORY._eraMetrics` yolu mevcut.
4. **Balon tamamen kaldırılmalı.** Refuted: önceki UX kararı dünya hâlini sohbetten çıkarıp üst çubuk hover/focus balonuna taşımıştı.

## 5) Remediation

- `storySeasonTooltip()` içinde mevsim başlığından sonra mevcut `storyWorldStateTooltip()` çıktısını ekle.
- Çağ adı ve açıklamasını elle yineleyen paralel metni kaldır; tek otoriteyi kullan.
- Mevsim çipi ve klavye erişilebilirliği davranışını değiştirme.

## 6) Verification Plan

- Kayıtlı `cityDossierProbe` çıktısında tooltip `KIŞ`, `Dünya dengesi`, `Savaş` ve `Refah` bilgilerini birlikte taşımalı.
- Odak/hover kararlılığı assertionları geçmeli.
- Sıralı assertion paketi sonraki kapıya ilerlemeli.
- Tam `npm test -- --keep-results` geçmeli.