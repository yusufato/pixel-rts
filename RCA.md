# RCA — Mekanik inceleme açıkken aynı görüşmede sosyal takip tamamen engelleniyor

## 1) Verdict

- **Root cause:** conversationSessionFollowUp yalnız session.status SOCIAL_RESPONSE_READY olduğunda çalışıyor; ticari görüşmeler açık açıklama soruları nedeniyle NEEDS_CLARIFICATION durumunda kaldığından sosyal ara konuşma ve belirsizlik onarımı daha analize girmeden reddediliyor.
- **Confidence:** Confirmed.

## 2) Failure Definition

- Beklenen: Ticari konu açıkken oyuncu aynı karaktere bugün nasılsın diyebilmeli, ardından konu belleği korunmalı ve belirsiz ifade açıklama istemeli.
- Gerçek: Her iki takip FOLLOW_UP_NOT_AVAILABLE; aynı session, CONTINUE_SOCIAL, activeTopic ve ambiguity repair kapıları false.
- Etki: Sohbet mekanik forma dönüşüyor; oyuncu doğal ara konuşma yapınca görüşme devam etmiyor.
- Blast radius: NEEDS_CLARIFICATION, domain review veya inceleme durumundaki açık görüşmelerin bütün takip mesajları.

## 3) Evidence

- Süreklilik fixtureı ticari şirket/sevkiyat cümlesiyle açılıyor ve açıklama soruları taşıyor.
- followUp fonksiyonu session.status !== SOCIAL_RESPONSE_READY koşulunda doğrudan dönüyor.
- Dört false alanın tamamı aynı iki reddedilen takip sonucundan türetiliyor.
- Uzun bağlam kapıları ayrı sosyal oturumlarda geçtiği için geçmiş saklama altyapısı sağlam.

## 4) Hypotheses

1. **Durum kapısı gereğinden dar.** Supported.
2. **DiscourseState ticari konuyu saklamıyor.** Refuted: başlangıç analizinden COMMERCE konusu oluşturuluyor; takip bu duruma ulaşamıyor.
3. **Check-in NLU tarafından tanınmıyor.** Refuted: bağımsız sosyal laboratuvarda CHECK_IN doğru.
4. **Belirsizlik onarım dalı yok.** Refuted: sosyal oturumlarda inheritedTopic ile CLARIFY_AMBIGUOUS_INPUT dalı var; çağrı kapıda reddediliyor.

## 5) Remediation

- Takipleri yalnız REJECTED veya sonlandırılmış resolution durumlarında engelle.
- Açık mekanik sorular, domain review ve negotiation incelemesi aynı görüşmede sosyal/bağlamsal tur yapılmasına engel olmamalı.
- Takip mesajı mekanik soruları otomatik cevaplamamalı, candidateı executable yapmamalı ve dünya mutasyonu üretmemeli.
- Mevcut tur ve session limitleri korunmalı.

## 6) Verification Plan

- checkInStaysSameSession, checkInIsSocialNotPreviousAnswer ve activeTopicPreserved true.
- ambiguousRequestsRepair true.
- Açık mekanik questions listesi takipten sonra hâlâ açık kalmalı; dünya mutasyonu false.
- Doğrudan laboratuvar, 10 fallback senaryosu ve tam paket geçmeli.