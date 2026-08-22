# 1) Verdict

- **Root cause:** Fiziksel çok-modlu lojistik entegrasyonu, yalnız `LAND/RAIL/SEA` segment rotaları için geçerli rezervasyon ve taşıt ajanını `ENERGY` makro-koridor sevkiyatlarına da zorunlu kılıyor.
- **Confidence:** Confirmed.
- **Chain:** İç dağıtım enerji kaynağı seçiyor → rota `ENERGY` modunda legacy makro rota olarak dönüyor → `segmentIds` yok → dispatch `PHYSICAL_ROUTE_RESERVATION_UNAVAILABLE` ile reddediliyor → batch bacağında `shipmentId=null` kalıyor → prob bulunmayan shipment’ın `.id` alanını okuyup TypeError veriyor.
- Hata devam ediyor; tam pakette ve tekil `distributionProbe` görevinde yeniden üretildi.

# 2) Failure Definition

- Görünen belirti: `TypeError: Cannot read properties of undefined (reading 'id')`, `tools/story-sim-harness.js:6717`.
- Asıl başarısızlık: `storyTradeCommitDomesticDistribution` sonucu `ok=false`, kod `PHYSICAL_ROUTE_RESERVATION_UNAVAILABLE`; ilk bacakta shipment oluşmuyor.
- Yeniden üretim: `node tools/story-test-parallel.js --task distributionProbe --workers 1`; 1/1 başarısız.
- Etki alanı: Fiziksel hex segmenti gerektirmeyen `ENERGY` koridorlarını kullanan ticaret ve ülke-içi dağıtım sevkiyatları.
- Regresyon kaynağı: zorunlu fiziksel rezervasyon `6ece5a5` ile 2026-08-20 tarihinde eklendi.

# 3) Timeline

| Zaman | Olay | Kaynak | Önemi |
|---|---|---|---|
| 2026-08-01 | Enerji kullanan iç dağıtım sözleşmesi ve prob eklendi | `e886a3f` | ENERGY sevkiyatı legacy makro ilerleme sözleşmesiyle çalışıyordu. |
| 2026-08-20 | Her dispatch için fiziksel rota rezervasyonu eklendi | `6ece5a5` | Kaynak/mod ayrımı olmadan `segmentIds` zorunlu oldu. |
| 2026-08-23 | Tam paket 62/88 sonrasında TypeError ile durdu | `npm test` | Dokümantasyon planı kapanışı yeniden engellendi. |
| 2026-08-23 | Tekil prob ve seed 2032 iç dökümü aynı sonucu verdi | İzole harness koşuları | İlk gerçek hata fiziksel rezervasyon reddi olarak belirlendi. |

# 4) Hypotheses (ranked)

## H1 — Fiziksel lojistik entegrasyonu ENERGY rotasını yanlışlıkla zorunlu segmentli sayıyor

- **If true, we would also see:** Admission geçer, commit ilk bacakta fiziksel rezervasyon koduyla reddedilir; route koridoru ENERGY olur ve `segmentIds` bulunmaz.
- **Discriminating test:** Seed 2032’de admission, committed sonucu, batch, order ve shipment listelerini birlikte yazdırmak.
- **Status:** Supported. Admission `ok=true`; commit `PHYSICAL_ROUTE_RESERVATION_UNAVAILABLE`; `corridor:energy:0:1:land`, shipment listesi boş.

## H2 — İç dağıtım stok veya makro koridor kapasitesi yetersiz

- **If true, we would also see:** Admission `DISTRIBUTION_STOCK_UNAVAILABLE` veya `DISTRIBUTION_CORRIDOR_CAPACITY_EXHAUSTED` döndürür.
- **Discriminating test:** Admission çıktısındaki exportable ve corridor demand değerlerini incelemek.
- **Status:** Refuted. Exportable 106,56; toplam istek 5; admission iki bacağı da kabul ediyor.

## H3 — Ticaret kargo sahipliği shipment oluşturmayı reddediyor

- **If true, we would also see:** Dispatch `COMMERCE_CARGO_UNAVAILABLE` veya `COMMERCE_CARGO_COMMIT_FAILED` döndürür.
- **Discriminating test:** Commitin gerçek hata kodunu ve commerce plan maliyetini görmek.
- **Status:** Refuted. Commerce cost 0,9 ve hata kargo commitinden önce fiziksel rota rezervasyonunda oluşuyor.

## H4 — Paralel worker yarışı shipmentı siliyor

- **If true, we would also see:** Tek görev/tek worker koşusunda hata kaybolur veya commit önce başarılı olup shipment sonradan eksilir.
- **Discriminating test:** `--task distributionProbe --workers 1` ve committen hemen sonraki ledger dökümü.
- **Status:** Refuted. Tek worker aynı hatayı veriyor; commit hiçbir shipment oluşturmadan reddediliyor.

# 5) Mechanism

1. Enerji kaynağının taşıma modu `storyTradeModes` tarafından `['ENERGY']` seçiliyor (`js/StoryTrade.js:144-154`).
2. `storyTradeFindRoute`, fiziksel planlayıcıyı yalnız `LAND/RAIL/SEA` modlarından biri varsa çağırıyor; ENERGY için `storyInfrastructureFindRoute` legacy makro rotasına düşüyor (`js/StoryTrade.js:737-763`).
3. Bu legacy rota geçerli `corridorIds` taşır fakat `segmentIds`, `microLegs` ve `routeId` taşımaz.
4. `storyTradeDispatchOrder`, rota türünü ayırmadan `segmentIds` yoksa doğrudan başarısız sonuç üretiyor (`js/StoryTrade.js:1120-1136`).
5. Oysa `storyTradeAdvanceShipment`, `transportVersion===2` olmayan sevkiyatlar için hâlâ geçerli legacy koridor ilerleme yolunu koruyor (`js/StoryTrade.js:1439-1479`).
6. Test probu committed sonucunu incelemeden batch bacaklarının shipmentlarını dereference ettiği için gerçek hata TypeError ile maskeleniyor (`tools/story-sim-harness.js:6706-6723`).

- **Root cause:** Fiziksel taşıt gerektiren modlar ile fiziksel olarak taşınmayan şebeke akışları arasında dispatch adaptör sınırının kaybolması.
- **Contributing factor:** Hex registry ENERGY/DATA koridorlarını üst LAND/SEA segmentleriyle ilişkilendiriyor fakat tam fiziksel rota için cell path/mode eşleşmesi sağlamıyor; onları sahte kamyon/ship ajanına çevirmek doğru değil.
- **Detection failure:** Çok-modlu dikey testler LAND/RAIL/SEA yollarını kapıladı, mevcut ENERGY iç dağıtım probu uzun paralel pakette geç çalıştığı için regresyon daha önce görünmedi.
- **Weakest link:** İlk başarısız commit bisect edilmedi; `git blame` ve çalışma zamanı mekanizması `6ece5a5` değişimini doğrudan işaret ediyor.

# 6) Remediation Options

## Mitigation

- **Title:** İç dağıtım probunu enerji yerine fiziksel yük kaynağıyla çalıştırmak
- **Category:** Mitigation
- **Severity:** High
- **Confidence:** Likely
- **Location:** `tools/story-sim-harness.js:6633-6750`
- **Evidence:** LAND/RAIL/SEA kaynaklarında segmentli rota kurulabilir.
- **Why it matters:** Test geçebilir fakat canlı ENERGY ticareti kırık kalır.
- **Recommended fix:** Uygulama; üretim hatasını test verisiyle saklar.
- **Tradeoffs / Risks:** Yanlış güven ve enerji ekonomisinin sessiz kilitlenmesi.

## Fix

- **Title:** Fiziksel rota rezervasyonunu yalnız segmentli taşıma rotalarında zorunlu tutmak
- **Category:** Fix
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** `js/StoryTrade.js:1120-1225`
- **Evidence:** Kod zaten `transportVersion===2` ve legacy shipment ilerleme yollarını birlikte destekliyor; ENERGY rotası makro koridor sözleşmesiyle doğrulanıyor.
- **Why it matters:** LAND/RAIL/SEA gerçek taşıt ve segment kapasitesini korurken ENERGY şebeke akışı sahte araç üretmeden tekrar çalışır.
- **Recommended fix:** `route.segmentIds` varsa rezervasyon + transport attach zorunlu olsun; yoksa yalnız desteklenen non-vehicle `ENERGY/DATA` makro modları legacy shipment yoluna alınsın. Fiziksel modda segment eksikse hata vermeye devam etsin.
- **Tradeoffs / Risks:** Mod kontrolü açık whitelist olmalı; herhangi bir bozuk LAND rotasının legacy’ye sessiz düşmesine izin verilmemeli.

## Prevention

- **Title:** ENERGY ve fiziksel taşıma dispatch yollarını ayrı regresyonlarla kapılamak
- **Category:** Prevention
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `distributionProbe` ve çok-modlu dikey testler
- **Evidence:** Mevcut testler iki davranışı ayrı ayrı ölçüyor fakat tam paket sırası regresyonu geç gösterdi.
- **Why it matters:** ENERGY düzeltmesi LAND/RAIL/SEA rezervasyon zorunluluğunu gevşetemez.
- **Recommended fix:** Mevcut `distributionProbe`, route planner ve canlı multimodal testlerini birlikte çalıştır; ENERGY shipmentta transport agent olmadığını, fiziksel shipmentta bulunduğunu doğrula.
- **Tradeoffs / Risks:** Hedef test süresi artar.

# 7) Verification Plan

- `node tools/story-test-parallel.js --task distributionProbe --workers 1` başarıyla bitmeli.
- İç dağıtım commit sonucu `ok=true`; iki batch bacağı ayrı shipment ve sahipli cargo lotu taşımalı.
- ENERGY shipmentları legacy makro rota ile teslim edilmeli ve fiziksel araç ajanı uydurmamalı.
- `node tests/story-route-planner.test.js`, `node tests/story-live-multimodal-vertical.test.js` ve üç taşıma dikey testi fiziksel segment rezervasyonunu korumalı.
- Son olarak `npm test` baştan sona geçmeli.
- Tekrar belirtisi: `PHYSICAL_ROUTE_RESERVATION_UNAVAILABLE` ile ENERGY dispatch reddi veya segmenti eksik LAND/RAIL/SEA rotasının sessiz legacy ilerlemesi.
