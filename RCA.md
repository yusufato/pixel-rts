# RCA — Tekrar onarım probu doğru cevabı aşırı dar metin kalıbıyla reddediyor

## 1) Verdict

- **Root cause:** Tekrar onarım cevabı doğru REPAIR_REPETITION hareketini ve doğrudan yeniden sorma yönlendirmesini taşıyor; harness yalnız aynı kalıp veya doğrudan cevap tam parçalarını kabul ediyor.
- **Confidence:** Confirmed.

## 2) Failure Definition

- Beklenen: Aynı şeyi söylüyorsun itirazı deterministik tekrar onarımına gitmeli ve aynı yanıtı kopyalamamalı.
- Gerçek motor: Haklısın; önceki cevabı tekrarladım. Son sorunu doğrudan ve yeni bilgi uydurmadan yeniden sor.
- Gerçek prob: Metinde doğrudan cevap bitişik olmadığı için false.
- Etki: Davranış doğru olduğu halde laboratuvar testi gereksiz sözcük dizilimine bağlı kalıyor.

## 3) Evidence

- discourseAct REPAIR_REPETITION.
- Kaynak DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE.
- Metin tekrarı kabul ediyor ve doğrudan yeniden sorma yönlendirmesi veriyor.
- Failure yalnız regex aynı kalıp|doğrudan cevap koşulunda.

## 4) Remediation

- Hareket etiketini zorunlu tut.
- Metin kapısını aynı kalıp veya doğrudan köküne hizala; tam cümle kopyasına bağlama.
- Aynı cevap kopyalanmaması ayrı repeatedHelpVaries kapısında korunuyor.

## 5) Verification Plan

- repetitionRepair true.
- discourseAct REPAIR_REPETITION zorunlu kalmalı.
- reason ve correction kapıları true kalmalı.
- Sıralı ve tam paket geçmeli.