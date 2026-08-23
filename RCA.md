# RCA — Dolu fiziksel rota topolojik rota yok diye sınıflanıyor

## Verdict

- **Root cause:** v2 route planner aktif segment rezervasyonlarını aday kapasiteden çıkarıyor; bütün segment kapasitesi ayrılınca aday kenar kalmıyor ve NO_ROUTE dönüyor. Trade dispatch bu sonucu topolojik rota yok olarak aynen iletiyor.
- **Confidence:** Confirmed.
- **Impact:** Aynı kapasite penceresindeki ikinci sevkiyat CORRIDOR_CAPACITY_EXHAUSTED yerine NO_ROUTE alıyor; otomatik sipariş katmanları geçici kapasite yarışını kalıcı topoloji yokluğu gibi ele alabilir.

## Evidence

- İlk sevkiyat 1.051 birimlik corridor:land:0:6 kapasitesinin tamamını ayırıp başarıyla teslim oluyor.
- İkinci sevkiyatın route sonucu boş ve reason=NO_ROUTE.
- Mantıksal/fiziksel koridor açıktır; ilk sevkiyat aynı 7 segmentli rotayı kullanmıştır.
- storyRoutePlannerCandidate rezervasyonu segment kapasitesinden düşürür ve bottleneck sıfırsa adayı eler; storyTradeDispatchOrder rota başarısızlığını sınıflandırmadan döndürür.

## Ranked Hypotheses

1. **Rezervasyon tükenmesi NO_ROUTE olarak sızıyor — Confirmed.** Aynı açık rota ilk sevkiyat tarafından tam ayrılmıştır.
2. **Fiziksel topoloji kopuk — Refuted.** İlk dispatch aynı koridorda ve segment zincirinde başarılıdır.
3. **Bölgesel stok yetersiz — Refuted.** Tezgâh iki tam kapasite ve pay kadar stok yerleştirir.
4. **Koridor hasarlı veya kapalı — Refuted.** Rota kesinti probundan sonra açılmıştır ve ilk kapasite dispatch'i geçer.

## Remediation

- Trade rota planı NO_ROUTE döndüğünde, rezervasyonları dikkate almayan altyapı rota görünümünde aynı kaynak-hedef için geçilebilir yol olup olmadığını kontrol et.
- Fiziksel yol varsa CORRIDOR_CAPACITY_EXHAUSTED, yoksa gerçek NO_ROUTE sonucunu koru.
- Sipariş retry davranışını geçici kapasite yarışına uygun tut; topolojik hata ile karıştırma.

## Verification

- Aynı pencerede ilk tam kapasite dispatch başarılı, ikincisi CORRIDOR_CAPACITY_EXHAUSTED olmalı.
- Gerçek kopuk rota hâlâ NO_ROUTE dönmeli.
- Korunan 88 görev sonucu üzerinde birleşik assertionlar yeniden çalıştırılmalı.
- Son tam npm test sıfır koduyla tamamlanmalı.
