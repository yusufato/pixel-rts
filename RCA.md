# RCA — Elli turluk kalite kapısı geçerli profil cevap kaynaklarını dışlıyor

## 1) Verdict

- **Root cause:** Kalite kapısı yalnız CHARACTER_DIALOGUE_REALIZER ve DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE kaynaklarını geçerli sayıyor; motorun günlük sosyal konuşmalar için kullandığı CHARACTER_PROFILE_SOCIAL_RESPONSE ve CHARACTER_PROFILE_SOCIAL_FOLLOW_UP kaynakları dışlanmış.
- **Confidence:** Confirmed.

## 2) Failure Definition

- Beklenen: Doğru niyet, geçerli karakter profili cevabı, bitişik tekrar olmaması, yeterli çeşitlilik ve yasak fallback bulunmaması kapıyı geçirmeli.
- Gerçek: 46 profil tabanlı sosyal cevap yalnız source etiketi yüzünden geçersiz sayılıyor.
- Etki: 50 turun tümü kabul edilip doğru sınıflansa da passed=false.
- Blast radius: fiftyTurnQualityGate kaynak kabul kümesi; canlı cevap üretimi etkilenmiyor.

## 3) Evidence

- Kaynak dağılımı: 3 CHARACTER_PROFILE_SOCIAL_RESPONSE, 43 CHARACTER_PROFILE_SOCIAL_FOLLOW_UP, 4 grounded response.
- allAccepted=true, intentsExact=true, adjacentRepeats=0, exactUniqueCount=20, forbiddenFallbackCount=0.
- allCharacterRealized=false yalnız kaynak filtresinden geliyor.
- Profil cevapları motorun kasıtlı deterministik günlük sohbet katmanı; LLM güvenlik fallbacki değildir.

## 4) Hypotheses

1. **Kaynak kabul kümesi eski.** Supported.
2. **50 tur yanlış niyet üretiyor.** Refuted: intentsExact=true.
3. **Bitişik aynı cevaplar var.** Refuted: adjacentRepeats=0.
4. **Seni dinliyorum fallbacki dönüyor.** Refuted: forbiddenFallbackCount=0.

## 5) Remediation

- İzinli deterministik sosyal kaynakları tek yardımcı kümede tanımla: profile opening, profile follow-up ve grounded discourse.
- CHARACTER_DIALOGUE_REALIZER kullanıldığında realization validator zorunluluğunu koru.
- Niyet, çeşitlilik, bitişik tekrar, benzerlik ve yasak fallback kapılarını koru.
- rolling exact repeats metriğini raporlamaya devam et; mevcut passed sözleşmesi bunu sıfır zorunluluğu yapmıyor.

## 6) Verification Plan

- allCharacterRealized ve passed true.
- turnCount=50, intentsExact=true, adjacentRepeats=0, exactUniqueCount>=16.
- forbiddenFallbackCount=0.
- Sıralı ve tam paket geçmeli.