# RCA — Kısa gerekçe ve karşıt konu düzeltmeleri söylem eylemine bağlanmıyor

## 1) Verdict

- **Root cause:** Grounded takip yönlendiricisi tek sözcüklü neden/niye gerekçe operatörünü ve hayır, X değil Y hakkında konuşuyorum karşıt düzeltme yapısını tanımlamıyor.
- **Confidence:** Confirmed.
- Her iki giriş genel ASK_INFORMATION veya UNKNOWN yoluna düşüyor; mevcut discourseState aktif konuyu saklasa da cevap seçici bu bağlamı kullanmıyor.

## 2) Failure Definition

- Beklenen: Neden? önceki karakter tutumunun gerekçesini açıklamalı; açık X değil Y düzeltmesi aktif konuyu Y olarak onarmalı.
- Gerçek: Neden? doğrulanmış kayıt yok sınırına, enerji düzeltmesi belirsiz girdi açıklamasına düşüyor.
- Etki: Oyuncu doğal artgönderim ve düzeltmelerle sohbeti sürdüremiyor; her tur bağımsız bot mesajı gibi hissediliyor.
- Blast radius: Kısa gerekçe soruları ve karşıt konu düzeltme kalıpları; dünya mutasyonu yok.

## 3) Evidence

- İlk askerî cevap geçerli ASSESS_UNVERIFIED_MILITARY_REQUEST ve active discourse state oluşturuyor.
- İkinci tur Neden? speechAct ASK_INFORMATION, discourseAct ANSWER_INFORMATION_BOUNDARY.
- Dördüncü tur Hayır, çelik değil enerji hakkında konuşuyorum speechAct UNKNOWN, discourseAct CLARIFY_AMBIGUOUS_INPUT.
- questionFocus yalnız açıklama, cevap talebi ve tekrar onarım kalıplarını içeriyor; ASK_REASON ve CORRECT_PREVIOUS_TOPIC yok.
- discourseState correctsPrior listesi de bu açık karşıt yapıyı kapsamıyor.

## 4) Hypotheses

1. **Bağlamsal söylem operatörleri eksik.** Supported.
2. **Aktif konu kaydı hiç yok.** Refuted: ilk substantive tur discourseState tarafından MILITARY olarak tutuluyor.
3. **LLM cevap veremiyor.** Refuted: grounded deterministik yönlendirici LLMden önce yanlış dalı seçiyor.
4. **Düzeltme dünya komutu gerektiriyor.** Refuted: bu yalnız konuşma bağlamı değişimidir ve worldMutation false kalmalıdır.

## 5) Remediation

- questionFocus içine kısa ASK_REASON ve açık karşıt CORRECT_PREVIOUS_TOPIC operatörleri ekle.
- Grounded cevapta önceki response/tutum üzerinden gerekçe üret; doğrulanmamış askerî istekte doğrulama ve yetki nedenini açıkla.
- Düzeltmede yeni konu sözünü metinden güvenli biçimde çıkar ve yalnız söylem bağlamını onar; dünya gerçeği veya emir üretme.
- DialogueMove kataloğuna iki hareketi CURRENT_TURN_ONLY politikasıyla kaydet.
- discourseState düzeltme algısına X değil Y karşıt yapısını ekle.

## 6) Verification Plan

- reasonTracksPriorPosition ve correctionApplied true.
- statePersisted son hareketi ve enerji içeren oyuncu metnini tutmalı.
- repetitionRepair true kalmalı.
- DialogueMove doğrulaması ve worldMutation=false korunmalı.
- Sıralı ve tam test paketi geçmeli.