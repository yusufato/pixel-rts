# RCA — Karakter eylemi göç testi güncel karar izi şemasını eski sürüm sanıyor

## Verdict

- **Root cause:** Uzun dünya kabul testi, sürüm 2 ve sürüm 3 karakter eylemi kayıtlarının göç sonucunu sabit `schemaVersion: 8` olarak bekliyor. Kanonik motor Faz 38.6 karar izi omurgasıyla `story-character-action-ledger-9` sözleşmesine geçmiş durumda ve göç doğru olarak `9` üretiyor.
- **Confidence:** Confirmed.
- **Impact:** Geçmiş makbuzlar, seçici politikası ve doğrulama korunmasına rağmen test doğru göçü yanlış negatif sayarak 88 görevlik kabul koşusunu durduruyor.

## Evidence

- `js/StoryCharacterActions.js` kanonik şemayı `9`, adaptörü `story-character-action-ledger-9` olarak tanımlıyor.
- `a3a8907` Faz 38.6 değişikliği `decisionContexts` ve `decisionTraces` defterlerini ekleyerek şemayı 8'den 9'a yükseltti.
- Göç kodu eski 1–8 kayıtlarını kabul ediyor, eksik karar bağlamı/izi koleksiyonlarını boş ve doğrulanabilir biçimde ekliyor, ardından güncel şema/adaptörü yazıyor.
- Korunan uzun koşuda sürüm-2 fikstürü `loaded=true`, `validation.ok=true`, `schemaVersion=9`, `receiptCount=7` üretti; hata yalnız testteki `expected 8 / actual 9` karşılaştırmasıdır.

## Ranked Hypotheses

1. **Assertion Faz 38.6 şema artışında güncellenmedi — Confirmed.** İki assertion hâlâ sürüm 8 ve eski makam/geçiş metnini bekliyor.
2. **Göç makbuz veya seçici politikasını kaybediyor — Refuted.** Yedi makbuz korunuyor, doğrulama geçiyor ve beklenen politika karması aynı.
3. **Motor yanlışlıkla gereksiz şema artışı yaptı — Refuted.** Şema 9 kalıcı karar bağlamı ve karar izi koleksiyonlarını ekleyen açık bir veri sözleşmesi değişikliğine bağlı.
4. **Sürüm-2/3 fikstürleri güncel kaydı doğrudan taklit ediyor — Refuted.** Harness bunları eski şemalara indirip yeni alanlar olmadan göç yolundan geçiriyor.

## Remediation

- Sürüm-2 ve sürüm-3 göç assertionlarını kanonik şema `9` beklentisine yükselt.
- Assertion açıklamalarını “makam geçişi” yerine Faz 38.6 karar bağlamı/izi sözleşmesini açıkça adlandıracak şekilde düzelt.
- Motoru ve göç kodunu değiştirme; kanıtlanan davranış doğrudur.

## Verification

- `characterActionsProbe` yeniden üretilip sürüm-2 ve sürüm-3 göçlerinin `schemaVersion=9`, geçerli defter ve korunmuş makbuzlar verdiği doğrulanmalı.
- Korunan 88 görev sonucu üzerinde bütün assertionlar geçmeli.
- Ardından temiz bir tam `npm test -- --keep-results` sıfır koduyla tamamlanmalı.
