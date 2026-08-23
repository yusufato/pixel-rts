# RCA — Uzun bağlam probu oturum sınırında budanan ilk kalite oturumunu seçiyor

## 1) Verdict

- **Root cause:** Konuşma kalite harnessı longContextSessionId değerini üç kalite oturumunun yalnız ilkinden alıyor; önceden oluşturulan çok sayıda sosyal oturum nedeniyle 32 kayıt sınırı bu ilk adayı daha ölçüm yapılmadan buduyor.
- **Confidence:** Confirmed.
- conversationSessionGet kimlik için null döndürüyor ve discourseContext null initialText okurken istisna oluşuyor.

## 2) Failure Definition

- Beklenen: Uzun bağlam ölçümü hâlâ ledgerda bulunan, en az 15 takip turuna sahip kalite oturumunu kullanmalı.
- Gerçek: Prob en eski kalite oturumunu sabitliyor; sonraki oturum açılışları FIFO budamasıyla onu siliyor.
- Etki: Ürün testi davranış assertionına ulaşmadan TypeError ile duruyor.
- Blast radius conversationUnderstandingProbe içindeki uzun bağlam kalite fikstürüdür; canlı oturum budaması beklenen davranıştır.

## 3) Timeline

| Zaman | Olay | Kanıt |
|---|---|---|
| Sosyal prob genişledi | Kalite döngüsünden önce çok sayıda oturum açıldı | story-sim-harness |
| Ledger sınırı | 32 oturum üstünde en eski kayıtlar budanıyor | STORY_CONVERSATION_SESSION_LIMIT |
| Güncel hedefli koşu | longContextSession null ve initialText TypeError | Worker stack |

## 4) Hypotheses (ranked)

1. **İlk kalite oturumu FIFO ile budanıyor.** Supported: yalnız sessionIndex 0 kimliği tutuluyor; sonraki begin çağrıları en eski oturumu siler.
2. **Ürün follow-up oturumu yanlış siliyor.** Refuted: budama yalnız session begin sonrasında belgelenmiş 32 sınırında çalışıyor.
3. **Yardım branchi session kimliğini bozdu.** Refuted: branch yalnız cevap nesnesi üretir, ledger session ekleme/silme yapmaz.
4. **Uzun bağlam için ilk oturum zorunlu.** Refuted: üç kalite oturumu da 15 veya 16 takip turu taşıyor ve >10 geçmiş kapısını karşılıyor.

## 5) Mechanism

1. Prob kalite döngüsüne zaten yüksek session sayısıyla girer.
2. İlk kalite oturumu longContextSessionId olarak kaydedilir.
3. İkinci/üçüncü kalite oturumu ledger sınırını aşar.
4. Begin budaması en eski kayıtlarla birlikte ilk kalite oturumunu siler.
5. Prob silinmiş kimliği alır, null nesneyi discourseContext fonksiyonuna verir.
- Root cause kırılgan eski-kayıt seçimi; contributing factor probun toplam session sayısının büyümesi; detection failure fikstürün kayıt sınırıyla birlikte tasarlanmamasıdır.

## 6) Remediation Options

### Mitigation

- Ürün session limitini büyütmek testi geçirir ama bellek sınırını test uğruna değiştirir; uygulanmamalı.

### Fix

- longContextSessionId değerini her kalite oturumu açılışında güncelle; döngü sonunda en yeni ve budanmamış oturumu kullan.
- Takip sayısı yine eski beş-tur penceresini aşacak kadar yüksek kalır.

### Prevention

- Bounded ledger testlerinde ölçüm adayının varlığını assert et ve en yeni fixtureyi seç.
- Ürün limitini test verisine uydurma.

## 7) Verification Plan

- Hedefli probe TypeError vermeden tamamlanmalı.
- longHistoryExceedsOldFiveTurnWindow ve token budget kapıları korunmalı.
- Session limitinin 32 değeri değişmemeli.
- Sequential ve tam test paketi geçmeli.