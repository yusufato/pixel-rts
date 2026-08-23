# RCA — Konuşma gizliliği fikstürü bağlamsız MAJOR karar üretiyor

## Verdict

- **Root cause:** `probeCharacterSpeechScenario`, özel AI–AI sözünün oyuncudan gizlendiğini sınamak için sentetik bir `NEGOTIATE` kararı kaydediyor fakat bu adayı kanonik karar bağlamına sunmuyor. Faz 38.6 `NEGOTIATE` eylemini `MAJOR` saydığı için bağlam ve karar izi zorunlu; motor izi haklı olarak üretmiyor ve defter `MAJOR_DECISION_TRACE_REQUIRED` ile geçersiz oluyor.
- **Confidence:** Confirmed.
- **Impact:** Konuşma metni, tekrar önleme ve gizlilik çıktıları doğru görünse bile geçersiz sentetik karar kaydı save kapısını düşürüyor; restore boş defterden geldiği için konuşma kalıcılığı assertionları da zincirleme başarısız olacak.

## Evidence

- Korunan `characterSpeechProbe` sonucu tek doğrulama sorunu olarak `$.arbiterDecisions.character-arbiter-decision:9.decisionTraceId` yolunda `MAJOR_DECISION_TRACE_REQUIRED` veriyor.
- `storyDecisionTraceImportance` içinde `NEGOTIATE` açıkça `MAJOR`, `PERSUADE` ise varsayılan `ROUTINE` sınıfındadır.
- Fikstür pending verisine `decisionContext` koymuyor ve `speech-fixture:private` gerçek aday kümesinden gelmiyor; `storyDecisionTraceV2Build` sunulmayan PROPOSE adayını reddediyor.
- Aynı probun amacı AI–AI özel sözünün gelen kutusu/UI'dan gizlenmesi; müzakere mekaniklerini veya MAJOR karar izini sınamak değildir. MAJOR iz sözleşmesi ayrı `decisionTraceV2Probe` tarafından gerçek aday bağlamıyla ölçülüyor.

## Ranked Hypotheses

1. **Konuşma gizliliği fikstürü kapsam dışı bir MAJOR eylem seçiyor — Confirmed.** Tek hata dokuzuncu özel NEGOTIATE kararının eksik izidir.
2. **Karar izi motoru geçerli adayı kaydetmiyor — Refuted.** Ayrı Faz 38.6 probu gerçek aday bağlamıyla iz kuruyor ve doğruluyor.
3. **Konuşma gerçekleştirici karar defterini mutasyona uğratıyor — Refuted.** Sorun realization alanında değil, kayıt anındaki actionType/trace zorunluluğunda oluşuyor.
4. **Save/load konuşma geçmişini kendiliğinden siliyor — Refuted.** Save geçersiz defteri kabul etmediği için prob eski/boş kaydı okuyor; bu bağımsız kalıcılık kaybı kanıtı değil.

## Remediation

- Özel görünürlük fikstürünü `NEGOTIATE` yerine rutin `PERSUADE` sözü olarak üret; hedefi oyuncu olmayan aynı karakterde tut.
- İlişki odaklı konuşma planı ve özel hedef korunarak UI/gelen kutusu gizlilik kapsamını değiştirme.
- MAJOR/WORLD karar izi zorunluluğunu gevşetme ve sahte karar bağlamı uydurma.

## Verification

- Yenilenen konuşma probunda defter doğrulaması, save/load, dokuz realization ve birebir metin geçmişi geçmeli.
- Özel AI–AI söz oyuncu gelen kutusunda ve sohbet UI'ında görünmemeli.
- Korunan 88 görev sonucu üzerindeki assertion zinciri yeniden çalıştırılmalı; son temiz tam paket sıfır koduyla tamamlanmalı.
