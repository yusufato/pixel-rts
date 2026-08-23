# RCA — Askerî destek probu güvenli alan hareketini yanlış etiketle reddediyor

## 1) Verdict

- **Root cause:** NLU düzeltmesinden sonra motor askerî destek isteğini doğru biçimde ASSESS_UNVERIFIED_MILITARY_REQUEST hareketine taşıyor; harness yalnız CONTINUE_REQUEST kabul ettiği için doğru güvenli cevabı başarısız sayıyor.
- **Confidence:** Confirmed.

## 2) Failure Definition

- Beklenen: Askerî destek talebi doğrulanmamış tehdit/konum için güvenli sınır koyan askerî hareketle başarılı sayılmalı.
- Gerçek: Prob yalnız genel yardım hareketini kabul ediyor.
- Etki: Doğru alan güvenliği başarısız görünür ve sonraki assertionlara ulaşılamaz.
- Blast radius: contextualFollowUp.militaryAnswer ölçütü; ürün cevabı ve NLU artık doğrudur.

## 3) Evidence

- speechAct REQUEST_SUPPORT.
- response source DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE.
- discourseAct ASSESS_UNVERIFIED_MILITARY_REQUEST.
- Cevap askerî desteği açıkça anlıyor ve doğrulama olmadan kuvvet hareketi sözü vermiyor.
- worldMutation false ve DialogueMove doğrulaması geçerli.

## 4) Hypotheses

1. **Harness eski genel hareket etiketini zorluyor.** Supported.
2. **NLU hâlâ ASK_INFORMATION üretiyor.** Refuted: güncel çıktı REQUEST_SUPPORT.
3. **Motor askerî isteği anlamıyor.** Refuted: cevap açıkça askerî destek ve kuvvet hareketinden söz ediyor.

## 5) Remediation

- militaryAnswer ölçütünü domain-özel ASSESS_UNVERIFIED_MILITARY_REQUEST hareketine hizala.
- Kaynak, speechAct, askerî metin ve dünya tarafsızlığı kontrollerini koru.
- Genel yardım testi CONTINUE_REQUEST beklemeye devam etsin; iki davranış birleştirilmesin.

## 6) Verification Plan

- militaryAnswer true.
- helpFollowUpUnderstood genel CONTINUE_REQUEST ile true kalmalı.
- Dünya mutasyonu false kalmalı.
- Sıralı ve tam test paketi geçmeli.