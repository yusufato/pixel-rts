# RCA — Ticaret kesinti eşiği fiziksel yükleme süresini yok sayıyor

## Verdict

- **Root cause:** Ticaret probu 20 saniyelik tick'in tamamını kesinti sayıyor; v2 fiziksel taşıt yaşam döngüsü önce 0,5 saniye yükleme yapıyor ve yalnız kalan 19,5 saniyeyi gerçek koridor beklemesi olarak interruptionSeconds alanına yazıyor.
- **Confidence:** Confirmed.
- **Impact:** Sevkiyat doğru biçimde HELD oluyor ve sonra teslim ediliyor, fakat birleşik kabul testi 19,5 değerini eski 20 eşiğiyle reddediyor.

## Evidence

- heldShipment.status=HELD ve holdReason=PHYSICAL_SEGMENT_BLOCKED.
- transportAgent.state=WAITING, waitingSeconds=19.5.
- deliveredShipment.status=DELIVERED ve interruptionSeconds=19.5.
- Hasarlı corridor:land:0:6 effectiveCapacity=0; blocked tick held=1, advanced=0, delivered=0.

## Ranked Hypotheses

1. **Eski eşik yükleme fazını yok sayıyor — Confirmed.** 20 saniyenin 0,5'i LOADING, 19,5'i WAITING.
2. **Kesinti telemetrisi hiç artmıyor — Refuted.** interruptionSeconds ve agent.waitingSeconds birlikte 19,5.
3. **Hasar koridoru kapatmıyor — Refuted.** effectiveCapacity=0 ve PHYSICAL_SEGMENT_BLOCKED.
4. **Yük kesintiye rağmen hareket ediyor — Refuted.** blocked tick advanced=0; adım ilerlemesi sıfır.

## Remediation

- Kabul testinde gerçek kesinti süresinin 19 saniyeden büyük olmasını zorunlu tut.
- Manifest kesintisini fiziksel agent waitingSeconds ile birebir eşleştir.
- 20 saniyenin tamamını kesinti diye yazmak için yükleme süresini yanlış biçimde kesinti telemetrisine katma.

## Verification

- Hedefli trade probunda status HELD, interruptionSeconds=waitingSeconds=19.5.
- Ticaret ve altyapı hedefli test paketleri geçmeli.
- Tam npm test sıfır koduyla tamamlanmalı.
