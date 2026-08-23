# RCA — Görüşme UI probu kaldırılmış geliştirici terimini bekliyor

## 1) Verdict

- **Root cause:** `uiShowsMechanicalResponse`, güncel UI bilgi sınırını Türkçe anlattığı halde literal `ACTORBELIEF` geliştirici terimini arıyor.
- **Confidence:** Confirmed.
- Motor cevabı, realization ve mekanik grounding ayrı kapılarda geçiyor; hata yalnız görünür etiket koşulunda.

## 2) Failure Definition

- Beklenen: Pencere doğrulanmış cevabı ve karakterin yalnız kendi bilgi kayıtlarını okuduğunu göstermeli.
- Gerçek UI: `DOĞRULANMIŞ KARAKTER CEVABI`, cevap metni ve `KARAKTER YALNIZ KENDİ BİLGİ KAYITLARINI OKUDU · DÜNYA DEĞİŞMEDİ`.
- Prob ayrıca artık görünmeyen `ACTORBELIEF` kelimesini zorunlu tutuyor.
- Blast radius yalnız konuşma UI harness ölçümüdür.

## 3) Timeline

| Zaman | Olay | Kanıt |
|---|---|---|
| 10 Ağustos 2026 | Doğrulanmış cevap UI yolu eklendi | Git geçmişi |
| Sonraki sadeleştirme | Teknik terim oyuncu diline çevrildi | `js/Talks.js` |
| 23 Ağustos 2026 | Önceki kapı düzelince bayat literal görünür oldu | Sequential assertion |

## 4) Hypotheses (ranked)

1. **Prob kaldırılmış literal terime bağlı.** Supported: UI kaynakta Türkçe eşdeğer var, `ACTORBELIEF` yok.
2. **Realization üretilemiyor.** Refuted: `listenerResponseRealized=true` ve `mechanicalGroundingPreserved=true`.
3. **Domain review render edilmiyor.** Refuted: `Talks.js` başlık, cevap ve güvenlik notunu aynı section içinde üretiyor.

## 5) Mechanism

1. Domain review doğru cevap ve realization üretir.
2. UI bunu Türkçe bilgi sınırı notuyla render eder.
3. Harness eski geliştirici terimini arar.
4. Semantik olarak doğru UI birleşik booleanı false yapar.
- Root cause bayat literal; contributing factor birleşik boolean; detection failure UI metin değişiminde test sözleşmesinin güncellenmemesidir.

## 6) Remediation Options

### Mitigation

- UI'ya `ACTORBELIEF` geri eklemek testi geçirir fakat oyuncuya iç mimari jargonunu sızdırır; uygulanmamalı.

### Fix

- Harness, `ACTORBELIEF` yerine tam Türkçe görünür bilgi sınırı ifadesini doğrulamalı. Risk yalnız gelecekte bilinçli metin değişiminde test güncellemesidir.

### Prevention

- Etiket, cevap metni ve güvenlik notunu ayrı tanısal booleanlarla ölçmek sonraki bakımda arızayı doğrudan gösterecektir.

## 7) Verification Plan

- `uiShowsMechanicalResponse=true` olmalı.
- Realization ve mekanik grounding true kalmalı.
- UI kişisel bilgi sınırı ile `DÜNYA DEĞİŞMEDİ` notunu korumalı.
- Sequential zincir ve son temiz `npm test -- --keep-results` geçmeli.
