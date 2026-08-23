# RCA — Kolektif eylem UI testi oyuncu protestosunu rastlantıya bırakıyor

## Verdict

- **Root cause:** Kolektif eylem kabul probu 180 saniyelik doğal simülasyonda herhangi bir devlet protesto üretince oyuncunun da karar penceresi görmesini koşulsuz bekliyor. Güncel deterministik seed yalnız yabancı ülkede protesto ürettiği için oyuncuya bildirim açılmaması doğru, assertion ise yanlış negatif.
- **Confidence:** Confirmed.
- **Impact:** Motor ve UI gizlilik sınırı doğru çalışırken test, oyuncuya ait olmayan olay için karar penceresi bekliyor; faz ilerledikçe değişen dünya dinamikleri kabul kapısını kararsızlaştırıyor.

## Evidence

- Dünya özeti `activeActionCount=1`, fakat oyuncunun bölgesel bilgisinde `activeActionCount=0`.
- `pendingResponseCount=0`, `responseNoticeCount=0` ve `staleResponseNoticeCount=0` birbiriyle tutarlı.
- Yabancı kolektif eylem kamusal olarak görünür, gizli seferberlik/radikalleşme alanları sızmıyor.
- Aynı probun saf durum makinesi deterministik bir `country:0` PROTEST fikstürü üretiyor; bu fikstür gerçek `storyCollectiveNotice` yolunu sınamak için kullanılabilir.

## Ranked Hypotheses

1. **Test oyuncu eylemini doğal dünya üretimine bağlıyor — Confirmed.** Güncel seed oyuncuda eylem üretmiyor.
2. **Bildirim sistemi oyuncu protestosunu yutuyor — Unproven/Not exercised.** Oyuncuya ait canlı protesto oluşmadığı için mevcut koşu bu yolu çağırmıyor.
3. **Bildirim süresi dolup gözlemden kaçıyor — Refuted.** Prob her 5 saniyede gözlüyor; oyuncu pending response hiç oluşmuyor.
4. **Yabancı eylem yanlışlıkla oyuncuya karar sunmalı — Refuted.** `storyCollectiveNotice` bilinçli olarak yalnız `state.isPlayer` için pencere üretir.

## Remediation

- Saf durum makinesinin ürettiği geçerli oyuncu protestosu fikstürünü test harness üzerinden gerçek bildirim üreticisine ver.
- Bildirimin dört yanıt seçeneğini taşıdığını gözle, ardından gerçek expire yoluyla temizle ve bayat düğme kalmadığını doğrula.
- Doğal 180 saniyelik dünyayı aktif eylem, bilgi sınırı ve simülasyon gerçekçiliği için koru; UI tetikleme garantisini seed tesadüfüne bağlama.

## Verification

- `responseNoticeCount>0`, seçenekler CONCEDE/NEGOTIATE/SUPPRESS/IGNORE ve son bayat bildirim sayısı 0 olmalı.
- Doğal dünya hâlâ en az bir kanıtlı eylem üretmeli ve yabancı sırları sızdırmamalı.
- Korunan 88 görev sonucunda bütün assertionlar geçmeli; son tam `npm test` sıfır koduyla tamamlanmalı.
