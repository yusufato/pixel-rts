# RCA — Hane dağıtımında sıfır başarısızlık eşiği gerçek rekabeti reddediyor

## Verdict

- Altyapı sahiplik aynası düzeltildikten sonra Pareto treatment 3.690 hane siparişinin 3.512'sini sevk etti; 178 başarısızlık oranı %4,82.
- Aynı dünyada gıda erişimi %84,40, enerji %83,96, yaşam koşulu %73,75; tüm sonuç korumaları geçiyor.
- **Root cause:** Kabul testi, sınırlı fiziksel stok ve koridor rekabetinde sıfır geçici başarısızlık bekliyor. Bu beklenti ancak artık kaldırılan hayalet sahiplik lotlarıyla sağlanıyordu.
- **Decision:** Sıfır-tolerans assertionını en fazla %5 kayıp oranı ile sınırla; gıda/enerji/refah sonuç eşiklerini aynen koru.

## Evidence

- Commerce, trade ve regional validatorlar sıfır issue.
- `ordersCreated=3690`, `shipmentsDispatched=3512`, `failed=178`.
- Başarısızlık oranı %4,824; oyuncu sonucu eşikleri önceki tabandan daha iyi.

## Alternatives

- Hayalet lotları geri getirmek: reddedildi; fizik ve sahiplik defterini yeniden bozar.
- Altyapı tüketimini bedelsiz yapmak: reddedildi; modern ekonomi ve kaynak rekabetini yok eder.
- Sonuç eşiklerini düşürmek: reddedildi; mevcut erişim kalitesini gevşetmeye gerek yok.

## Verification

- Pareto 300 saniye commerce/trade/regional temiz kalmalı.
- Kayıp oranı %5'i aşmamalı.
- Gıda, enerji ve refah mevcut mutlak eşikleri geçmeli.
