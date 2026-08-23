# RCA — Dolaylı askerî destek isteği soru olarak yanlış sınıflanıyor

## 1) Verdict

- **Root cause:** Speech-act puanlayıcısı REQUEST_SUPPORT için dar sabit kalıplar kullanıyor; desteğini istesem kabul eder misin ifadesi bu listede yok ve genel soru işareti ASK_INFORMATION sınıfını kazanıyor.
- **Confidence:** Confirmed.
- Ordu bağlamı doğru algılanıyor fakat bu bağlam yalnız primary act zaten REQUEST_SUPPORT ise askerî destek requesti oluşturuyor.

## 2) Failure Definition

- Beklenen: Ordu topluyorum, desteğini istesem kabul eder misin? sözü REQUEST_SUPPORT ve askerî destek isteği olarak anlaşılmalı.
- Gerçek: ASK_INFORMATION, ANSWER_INFORMATION_BOUNDARY ve kesin yanıt veremem cevabı üretiliyor.
- Etki: Oyuncunun doğal dolaylı talepleri bilgi sorusu sanılıyor; sonraki neden, tekrar ve düzeltme zinciri yanlış bağlamdan devam ediyor.
- Blast radius: Yardım/destek kökü içeren fakat mevcut yedi sabit kalıba uymayan dolaylı destek talepleri.

## 3) Evidence

- Hedefli probun ilk bağlamsal turu FOLLOW_UP_RECORDED ancak speechAct ASK_INFORMATION.
- Cevap ANSWER_INFORMATION_BOUNDARY ve kaynak DETERMINISTIC_KNOWLEDGE_BOUNDARY_RESPONSE.
- Cümlede ordu bulunduğu için militaryContext true olabilecek veri mevcut.
- REQUEST_SUPPORT listesi desteğini istesem veya destek kabulü sorusunu içermiyor.
- Request üretimi act.primary REQUEST_SUPPORT koşuluna bağlı olduğu için askerî bağlam tek başına sınıfı düzeltemiyor.

## 4) Hypotheses

1. **Dolaylı destek kalıbı puanlanmıyor.** Supported: gerçek çıktı ASK_INFORMATION; sabit listede ifade yok.
2. **Askerî bağlam algılanmıyor.** Refuted: ordu açıkça militaryContext kelime kümesinde.
3. **DialogueMove kataloğu destek hareketini reddediyor.** Refuted: bu turda hareket geçerli ANSWER_INFORMATION_BOUNDARY; hata sınıflandırmadan önce değil sınıflandırmadadır.
4. **Takip oturumu kullanılamıyor.** Refuted: sonuç FOLLOW_UP_RECORDED ve cevap mevcut.

## 5) Mechanism

1. Soru işareti ve kabul eder misin yapısı genel bilgi sorusu puanı alır.
2. Dar REQUEST_SUPPORT kalıbı eşleşmez.
3. Primary act ASK_INFORMATION olur.
4. militaryContext request aşamasında kullanılamaz çünkü REQUEST_SUPPORT önkoşulu sağlanmaz.
5. Konuşmanın aktif konusu askerî destek yerine bilgi sınırı olur.

## 6) Remediation

- Yardım veya destek kökü ile istek/kabul soru yapısını bileşik olarak puanlayan genel bir destek-talebi kuralı ekle.
- destegini istesem, destek istiyorum, yardimini istiyorum ve kabul eder misin benzeri biçimleri sabit tümce yerine iki anlamsal kümenin çarpımıyla kapsa.
- OFFER_SUPPORT birinci tekil teklif kalıplarıyla karışmamalı.
- Dünya mutasyonu ve kabul vaadi yine yasak kalmalı.

## 7) Verification Plan

- İlk bağlamsal tur REQUEST_SUPPORT olmalı.
- Cevap askerî destek kapsamını belirtmeli ve bağımsız selamlama/fallback olmamalı.
- Sonraki neden, tekrar onarımı ve konu düzeltmesi aynı oturumda geçmeli.
- Doğrudan konuşma laboratuvarı ve 10 güvenli-fallback senaryosu korunmalı.
- Sıralı ve tam test paketi geçmeli.