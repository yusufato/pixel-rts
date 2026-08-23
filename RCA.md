# RCA — Oyuncu eylem kabul testi jsdom dizisini ana realm dizisiyle karşılaştırıyor

## 1) Verdict

- **Root cause:** Yeni 18-aile kabul testi, jsdom VM realm'inden dönen `acceptance.missing` dizisini Node ana realm'inde yaratılan `[]` ile `assert.deepStrictEqual` üzerinden karşılaştırıyor.
- **Confidence:** Confirmed.
- Değerler aynı; prototip/realm kimliği farklı olduğu için Node 26 karşılaştırması reddediyor.

## 2) Failure Definition

- Beklenen: Eksik aile sayısı sıfır olduğunda kabul kapısı geçmeli.
- Gerçek: `actual: []`, `expected: []` olmasına rağmen “same structure but not reference-equal” assertionı oluşuyor.
- Etki: Yeni kabul testi ilk yapısal kontrolde duruyor; oyun runtime'ı etkilenmiyor.

## 3) Evidence

- Hata `tests/story-player-agency.test.js:48` satırındaki jsdom kaynaklı `acceptance.missing` karşılaştırmasında.
- Assertion çıktısı iki tarafı da boş dizi gösteriyor.
- Harness API'si VM bağlamındaki nesneyi doğrudan döndürüyor.

## 4) Hypotheses

1. **Cross-realm dizi prototipi strict deep karşılaştırmayı bozuyor.** Supported.
2. **Gerçekte eksik sistem ailesi var.** Refuted: `missing` iki tarafta da boş ve `actionable=18`.
3. **Oyuncu eylem defteri geçersiz.** Refuted: hata defter yürütülmeden, görünüm kabul kontrolünde.

## 5) Remediation

- VM dizilerini assertion öncesinde `Array.from` ile ana realm yalın dizisine dönüştür.
- Sayısal ve boolean kapıları koru; assertionı gevşetme.

## 6) Verification Plan

- 18/18 test bütün rol fixture'larını ve gerçek mutasyonları tamamlamalı.
- Ret, UI ve save/load kapıları korunmalı.