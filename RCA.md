# RCA — Genel yardım takip hareketi diyalog sözleşmesinde kayıtlı değil

## 1) Verdict

- **Root cause:** StoryConversationUnderstanding genel REQUEST_SUPPORT takibi için CONTINUE_REQUEST hareketi üretiyor; StoryDialogueMove hareket kataloğu bu eylemi tanımıyor.
- **Confidence:** Confirmed.
- Sonuçta takip mesajı ilk çağrıda kaydediliyor, ledger doğrulaması DIALOGUE_MOVE hatası veriyor ve sonraki ensure çağrısı bütün konuşma ledgerını güvenli sıfırlıyor.

## 2) Failure Definition

- Beklenen: Genel yardım isteğinin takip cevabı doğrulanmış bir DialogueMove taşımalı ve aynı oturum sonraki turlarda korunmalı.
- Gerçek: İlk genel yardım turundan sonra DIALOGUE_MOVE doğrulama hatası oluşuyor; sonraki oturum çağrısında kayıtlar sıfırlanıyor.
- Etki: Uzun bağlam, oturum sürekliliği ve günlük sohbetler görünürde rastgele sıfırlanıyor.
- Blast radius: CONTINUE_REQUEST üreten genel yardım takipleri; açılış NLU analizi ve dünya simülasyonu etkilenmiyor.

## 3) Evidence

- Hedefli probda ilk geçersiz durum kalite oturumu 0, takip turu 6 üzerinde oluştu.
- Bu turdaki metin Bana bu konuda yardım eder misin? ve speechAct REQUEST_SUPPORT.
- conversationSessionFollowUp FOLLOW_UP_RECORDED döndürdü.
- Ham ledger doğrulaması aynı anda DIALOGUE_MOVE yolunu işaretledi.
- StoryDialogueMove kataloğunda CONTINUE_MILITARY_SUPPORT_REQUEST var, CONTINUE_REQUEST yok.
- Bir sonraki ensure çağrısında validator başarısızlığı ledger resetini tetikliyor; bu yüzden session kimliği 1 olarak yeniden başlıyor ve liste boş görünüyor.

## 4) Hypotheses

1. **CONTINUE_REQUEST kataloga kayıtlı değil.** Supported: üretici eylemi yazıyor, doğrulayıcı ACT_NOT_REGISTERED üretiyor.
2. **32 oturum sınırı en yeni oturumu buduyor.** Refuted: tanı çıktısında her begin yeniden conversation-session:1 üretiyor ve liste boş; bu FIFO budaması değil reset belirtisi.
3. **Follow-up sayısı tur sınırını aşıyor.** Refuted: hata yedinci takipte, sınır 24.
4. **NLU yardım isteğini tanımıyor.** Refuted: analiz REQUEST_SUPPORT üretiyor.

## 5) Mechanism

1. Genel yardım takibi REQUEST_SUPPORT olarak çözümlenir.
2. Grounded cevap CONTINUE_REQUEST discourseAct değerini üretir.
3. DialogueMove oluşturucu katalogda politika bulamayınca UNREGISTERED_ACT kaynak politikası yazar.
4. Ledger validator hareketi geçersiz bulur.
5. Sonraki ensure onarım yapamayınca güvenli reset uygular.
6. UI ve uzun bağlam testleri oturumu kaybetmiş görünür.

## 6) Remediation

- StoryDialogueMove hareket kataloğuna CONTINUE_REQUEST ekle.
- Politika CURRENT_TURN_ONLY olmalı; claimTypes boş, memory false kalmalı.
- Dünya komutu, anlaşma kabulü veya gizli bilgi yetkisi eklenmemeli.
- Üretici ve doğrulayıcı aynı committe test edilmelidir.

## 7) Verification Plan

- Hedefli conversationUnderstandingProbe çökmeden tamamlanmalı.
- Genel yardım takip cevabı DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE ve CONTINUE_REQUEST taşımalı.
- Aynı yardımın tekrarı REPAIR_REPETITION üretmeli.
- Ledger validation ok kalmalı ve session kimlikleri artmalı.
- Sıralı assertion ve tam npm test paketi geçmeli.