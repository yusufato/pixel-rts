# RCA — Altyapı rezervasyonu sahiplik lotunu tüketmiyor

## Verdict

- **Root cause:** `StoryInfrastructureWorks` rota ve bakım malzemelerini doğrudan bölgesel stoktan düşürüyor; aynı malların `StoryCommerce` sahiplik lotları değişmiyor.
- **Confidence:** Confirmed.
- **Impact:** Pareto 300 saniyelik dünyada regional/trade defterleri geçerken commerce fizik aynası 7 bölgede bozuluyor.

## Evidence

- Seed 2032 treatment: yalnız 7 `COMMERCE_PHYSICAL_MIRROR_MISMATCH`; trade ve regional validation sıfır issue.
- Farklar 21/14, 28/28/2, 36/24; `STORY_INFRA_ROUTE_POLICY` kenar başı malzeme formülleriyle tam uyumlu.
- Rota rezervasyonu satır 382–391 ve bakım rezervasyonu satır 1616–1625 yalnız `economy.stockDelta` çağırıyor.
- Kod tabanında fiziksel stok kaybının sahiplik iddiasını da yok eden kanonik API `storyCommerceApplyPhysicalLoss`.

## Ranked Hypotheses

1. **Altyapı tüketimi commerce kapısını atlıyor — Confirmed.** Sabit farklar malzeme gereksinimleriyle eşleşiyor.
2. **Trade teslimatı lotu iki kez yaratıyor — Refuted.** Trade validator temiz; fark yalnız inşaat fonlayan bölgelerde ve girdi boyutunda.
3. **Pareto üretim tüketimi lotu azaltmıyor — Refuted.** Üretim `storyCommerceOnProductionCommitted` üzerinden slice tüketiyor.
4. **Floating point yuvarlama — Refuted.** Farklar 2–36 tam birim; tolerans 1e-4 sorunu değil.

## Mechanism

1. Ekonomik AI geçerli rota projesi seçer.
2. Gereksinimler fiziksel stokta kontrol edilir.
3. Rezervasyon `storyRegionalStockDelta` ile malzemeyi düşürür.
4. Sahiplik lotu aynı miktarda kalır.
5. Commerce validator fiziksel stok ile lot toplamını karşılaştırıp projelerin toplam maliyeti kadar fark bulur.

## Remediation

- Negatif altyapı malzeme rezervasyonunu fiziksel stok düşüşünden sonra `storyCommerceApplyPhysicalLoss` ile eşleştir.
- Commerce tüketimi başarısızsa aynı fiziksel delta'yı geri al ve rezervasyonu atomik olarak reddet.
- Rota ve bakım yollarını ortak helper üzerinden geçir; pozitif rollback deltaları yeniden sahiplik tüketmemeli.

## Verification

- Pareto seed 2032 / 300 saniye: commerce, trade ve regional validation sıfır issue.
- Altyapı works/route/economic-AI testleri geçmeli.
- Son olarak tam `npm test` sıfır koduyla tamamlanmalı.
