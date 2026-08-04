# KÖK NEDEN: `forceRatio` bir kuvvet oranı değil, kendi sağkalım yüzdesi

**Analistin hipotezi doğrulandı ve koda kadar izlendi.** Handikap maçında (insan 4410₺ / AI 6460₺)
AI **31 birimle 16 birime karşı bir kez bile taarruz etmedi**; duruş gerekçesi hep `kuvvet-orani`.

## Ölçüm (handikap maçı, kırmızı = AI savunan)

| sn | AI'ın sandığı oran | GERÇEK oran (AI₺/insan₺) | sapma |
|---|---|---|---|
| 0 | **1.00** | 1.46 | −%32 |
| 90 | 0.89 | 1.47 | **−%39** |
| 180 | 0.74 | 1.42 | **−%48** |
| 240 | 0.60 | 1.12 | −%46 |
| 360 | 0.27 | 0.68 | −%60 |

## Kök neden ([BattlePerception.js:131](../js/BattlePerception.js#L131))

```js
const intelligenceFloor = Math.max(0, this.initialFriendlyValue - this._confirmedKilledValue);
const estimatedEnemyValue = Math.max(observedEnemyValue, intelligenceFloor);
const forceRatio = friendlyValue / estimatedEnemyValue;      // BattleSituation.js:306
```

İstihbarat tabanı **düşmanın gücünden değil, KENDİ başlangıç değerimden** türetiliyor (kodun kendi
yorumu: *"başlangıç-tahmini(parite)"*). Sonuçları:

1. **t=0'da oran DAİMA tam 1.00** — düşman ister yarı ister iki katı olsun. Ölçümde t=0 = 1.00 ✓.
   AI, +%46 üstünlükle başladığı maçta kendini "başabaş" sanıyor.
2. `friendlyValue` her kayıpla düşer; taban ise yalnız **teyitli** imhayla düşer. Teyit eksik kalınca
   oran ≈ `benim güncel değerim / benim ilk değerim` = **kendi sağkalım yüzdem**.
   Doğrulama: 1760/6460 = 0.272 → ölçülen 0.27 ✓ (birebir).
3. Bu yüzden oran **1.0'ın üstüne pratikte hiç çıkamaz** ve monoton düşer.

## Neden her şeyi kilitliyor
STRIKE kapısı `ratioOK = forceRatio >= eşik` istiyor (taban 1.15; savunanda `DEFENDER_URGENCY_DROP: 0.1`
eşiği çok az kıpırdatır). Oran yapısal olarak ≤1.0 olduğundan **kapı savunan için matematiksel olarak
ulaşılamaz**. Yumuşatma penceresi, şok-sömürü, sektör kilidi — hepsi bu kapının ardında.
Bu, "savunma edilgen" gözleminin *doktrin* değil **hesap hatası** olduğunu gösteriyor.

## Önerilen düzeltme (bayraklı, pro-delta `trueForceRatio`)
Parite tabanı **düşmanın ilan edilmiş bütçesinden** türetilmeli (maç kuralı; iki taraf da bilir → hile değil):
`floor = enemyStartingBudget − confirmedKilledValue`.
Ek olarak teyitli-imha muhasebesi denetlenmeli: handikap maçında AI 12 birim öldürdü ama tabanın
düşüşü bunun ~%40'ı kadardı → görülmeden ölen düşman hiç düşülmüyor.

**Kabul ölçütü:** aynı handikap maçında t=0 oranı ≈1.46 çıkmalı ve savunan en az bir kez STRIKE'a geçmeli.
Sonra `--intel4pro` ve `--comptest` yeniden ölçülmeli (bu değişiklik tüm denge sonuçlarını etkiler).
