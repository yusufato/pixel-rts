# RCA — Agreement UI probu eylem öncesi render ve eski panel konumu kullanıyor

## 1) Verdict

- **Root cause:** Harness görüşme penceresini PERSUADE eyleminden önce render ediyor, eylemden sonra yenilemiyor ve kaydı 15 Ağustosta kaldırıldığı `conversation-workspace-history` alanında arıyor.
- **Confidence:** Confirmed.
- Güncel ürün sözleşmesinde uygulanmış eylem kayıtları sol profilin `İLİŞKİ` sekmesindeki ilişki zincirinde gösteriliyor.

## 2) Failure Definition

- Beklenen: Başarılı PERSUADE makbuzu güncel görüşme UI kayıt yüzeyinde görünmeli.
- Gerçek prob sırası: render → metni al → PERSUADE uygula → yeniden render etmeden eski history alanını sorgula.
- Birleşik koşul ayrıca başarısız makbuzu `!agreementReceipt.ok` ile başarı sayıyor.
- Blast radius yalnız agreement görünürlük ölçümüdür; UI üretim yolu kayıtları güncel İLİŞKİ sekmesine projekte ediyor.

## 3) Timeline

| Zaman | Olay | Kanıt |
|---|---|---|
| 10 Ağustos 2026 | Agreement probu eski sağ kayıt paneline yazıldı | `10a81699` blame |
| 15 Ağustos 2026 | Anlaşma ve kayıtlar İLİŞKİ sekmesine taşındı | `12b693ce` blame |
| 23 Ağustos 2026 | Başarılı eylem eski/stale görünümde aranarak false oldu | Sequential assertion |

## 4) Hypotheses (ranked)

1. **Prob render sırası ve hedef paneli bayat.** Supported: kaynakta render eylemden önce; UI yorumu kayıtların İLİŞKİ sekmesine taşındığını açıkça söylüyor.
2. **Ürün kayıt projeksiyonu kaldırıldı.** Refuted: `storyTalkConversationKnownRecords` APPLIED PERSUADE eylemini `İkna girişimi` olarak ilişki zincirine ekliyor.
3. **Fikstür teardown hâlâ başarısız.** Refuted: `diplomaticFixtureRestored=true`; yeni hata aynı şekilde sürüyor ve kaynakta bağımsız stale UI akışı var.

## 5) Mechanism

1. Modal eylem öncesi render edilir.
2. PERSUADE başarılı makbuz üretir.
3. DOM yenilenmediği için yeni kayıt görünmez.
4. Assertion artık yalnız konuşma geçmişi içeren sağ paneli arar.
5. Başarılı makbuz nedeniyle hatalı `!ok` kaçış dalı da false olur; aggregate düşer.
- Root cause bayat test akışı; contributing factor UI taşımasında prob güncellenmemesi; detection failure başarısız eylemi başarı sayan ters koşuldur.

## 6) Remediation Options

### Mitigation

- Başarısız makbuzu görünürlük başarısı saymak testi yeşil tutabilir fakat false positive üretir; kaldırılmalı.

### Fix

- Başarılı PERSUADE sonrası workspace yeniden render edilmeli, İLİŞKİ sekmesi DOM olayıyla açılmalı ve `İkna girişimi` güncel profil yüzeyinde aranmalı.
- Profil görünürlüğü sekme değişiminden önce snapshotlanmalı.

### Prevention

- UI probları eylem başarı, rerender ve güncel yüzey görünürlüğünü ayrı booleanlarla ölçmeli; layout taşımasında selector sözleşmesi güncellenmeli.

## 7) Verification Plan

- Agreement receipt `ok=true` olmalı.
- Rerender ve İLİŞKİ sekmesi sonrası profil metni `İkna girişimi` içermeli.
- Başarısız makbuz artık görünürlük başarısı sayılmamalı.
- Profil, geçmiş, WASD, hafıza, sequential ve temiz tam test geçmeli.
