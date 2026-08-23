# RCA — Diplomatik söz ihlali probu sınır aşan taraf önkoşulunu kurmuyor

## 1) Verdict

- **Root cause:** Konuşma probu ilk ikna edilebilir teması seçiyor; güncel dizinde bu kişi oyuncuyla aynı `country:0` ülkesinde. Buna rağmen diplomatik alt test `crossBorder=true` bekliyor.
- **Confidence:** Confirmed.
- Motor aynı ülke söz ihlalini doğru biçimde ticari uyuşmazlıkta tutuyor; protesto ve anayasal savaş/barış zinciri bu yüzden açılmıyor.

## 2) Failure Definition

- Beklenen alt senaryo: İki farklı ülke aktörü arasındaki gerçek BROKEN söz, devlet yetkisi isteyen protesto incelemesi üretmeli.
- Gerçek fikstür: Oyuncu `country:0`; ilk ikna edilebilir temas `character:0:president`, yine `country:0`; yabancı ikna edilebilir temas yok.
- Sonuç: `candidate.crossBorder=false`, `legalStanding=false`; diplomatik review güvenlik ve sonraki yetki kapıları false.
- Blast radius yalnız bu birleşik konuşma probunun diplomatik/anayasal alt zinciridir.

## 3) Timeline

| Zaman | Olay | Kanıt |
|---|---|---|
| 12 Ağustos 2026 | Diplomatik alt zincir mevcut şirket görüşmesi probuna eklendi | `4fb397e` blame |
| Sonraki temas dizini gelişimi | Kendi ülke temasları önceliklendi | `StoryContacts.js` sıralaması |
| 23 Ağustos 2026 | Doğrudan runtime ölçümü ilk teması aynı ülke gösterdi | Seed 2033 ölçümü |

## 4) Hypotheses (ranked)

1. **Fikstür sınır aşan taraf kurmuyor.** Supported: ilk ikna edilebilir aktör ve oyuncu aynı `country:0`; yabancı ikna edilebilir temas yok.
2. **Diplomatik review motoru BROKEN olayı tanımıyor.** Refuted: review çağrısı ok/idempotent; ticari zarar ve savaş engelleri doğru üretiliyor.
3. **Durum önceliği düzeltmesi diplomasi zincirini bozdu.** Refuted: ülke seçimi durum fonksiyonundan bağımsız ve aynı seed doğrudan ölçüldü.

## 5) Mechanism

1. Contact directory kendi ülke/doğrudan temasları öne sıralar.
2. Prob ilk PERSUADE eylemi açık kişiyi seçer.
3. Hem oyuncu hem muhatap `country:0` olur.
4. Söz sonucu ülke kimliklerinden `crossBorder=false` hesaplar.
5. Diplomatik review yasal dayanağı reddeder; protesto ve anayasal devam zinciri doğal olarak kapanır.
- Root cause eksik fikstür önkoşulu; contributing factor uzun probun tek görüşmeyi farklı alanlar için yeniden kullanması; detection failure aktör ülke ayrımı için açık assertion olmamasıdır.

## 6) Remediation Options

### Mitigation

- Diplomatik assertionları kaldırmak kapsam kaybıdır ve uygulanmamalı.

### Fix

- Yalnız diplomatik alt senaryodan hemen önce test muhatabının kimliğini deterministik yabancı ülkeye bağla; oyuncu ve şirket görüşmesinin önceki davranışını değiştirme.
- Risk: Fikstür mutasyonu üretim davranışı değildir; runtime kapanınca kaybolur.

### Prevention

- Diplomatik alt ölçüme `fixturePartiesCrossBorder` tanısı eklemek veya bu zinciri ayrı prob yapmak önkoşul kaymasını anında gösterir.

## 7) Verification Plan

- Broken consequence `crossBorder=true` ve iki farklı `partyCountryIds` taşımalı.
- Review protesto için devlet yetkisi istemeli; ham ilişki/antlaşma dünyasını değiştirmemeli.
- Yanlış devlet ve yürütülmemiş yetki reddedilmeli; doğru protesto bir kez çalışmalı ve savaş üretmemeli.
- Anayasal savaş/barış güvenlik kapıları ile sequential zincir ve son temiz test geçmeli.
