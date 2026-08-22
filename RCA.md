# 1) Verdict

- **Root cause:** `world.canonicalMapRaster=false` iken sözleşme gereği null dönen raster, sonradan eklenen altıgen coğrafya başlatıcısında zorunlu nesne gibi okunuyor.
- **Confidence:** Confirmed.
- **Chain:** A/B bayrağı kanonik rasterı kapatıyor → `storyMapRasterEnsure()` null → kampanya altıgen altyapıyı sıfırlıyor → `storyHexGeographySourceHash` null rasterın `sourceHash` alanını okuyor → kampanya açılışı çöküyor.
- Hata devam ediyor; tam pakette ve tekil `mapRasterProbe` görevinde yeniden üretildi.

# 2) Failure Definition

- Kesin belirti: `TypeError: Cannot read properties of null (reading 'sourceHash')`, `js/StoryHexGeography.js:62`.
- Yeniden üretim: `node tools/story-test-parallel.js --task mapRasterProbe --workers 1`; 1/1 başarısız.
- Etki alanı: `world.canonicalMapRaster` kapalı başlatılan kampanyalar ve bu A/B yolunu kullanan doğrulama.
- İlk oluşum kesin değil. Raster A/B probu eski, altıgen coğrafya tüketimi daha sonra `224dee6` ile eklendi.

# 3) Timeline

| Zaman | Olay | Kaynak | Önemi |
|---|---|---|---|
| 2026-08-01 | Kanonik raster kapalı A/B probu eklendi | `e886a3f` | Kapalıyken `mapRasterEnsure() === null` sözleşmesi kuruldu. |
| 2026-08-17 | Altıgen coğrafya raster tüketicisi eklendi | `224dee6` | Null sözleşmesi yeni tüketiciye taşınmadı. |
| 2026-08-22 | Tam paket 30/88’de çöktü | `npm test` | Belge planının kapanması yeniden engellendi. |
| 2026-08-22 | Tekil prob aynı stack ile çöktü | `--task mapRasterProbe --workers 1` | Hata deterministik olarak izole edildi. |

# 4) Hypotheses (ranked)

## H1 — Altıgen coğrafya kanonik rasterın kapalı olabileceğini hesaba katmıyor

- **If true, we would also see:** Doğrudan raster API null dönerken kampanya reset zinciri coğrafya hash’inde çöker.
- **Discriminating test:** Yalnız `mapRasterProbe` görevini tek worker ile çalıştırmak.
- **Status:** Supported. Stack `storyMapRasterEnsure → null` sonrasında `storyHexGeographySourceHash` alan okumasında bitiyor.

## H2 — Raster varlığı bozuk veya eksik yüklendi

- **If true, we would also see:** Bayrak açık ana prob veya `prebuiltRasterProbe` raster doğrulamasında da hata oluşur.
- **Discriminating test:** Tam paket çıktısındaki `prebuiltRasterProbe` tamamlanmasını ve hata bağlamındaki bayrağı karşılaştırmak.
- **Status:** Refuted. `prebuiltRasterProbe` geçti; çöküş yalnız açıkça `world.canonicalMapRaster:false` kampanyasında oluştu.

## H3 — Paralel worker paylaşılmış global durum nedeniyle rasterı kaybetti

- **If true, we would also see:** Tek worker/tek görev koşusunda hata kaybolur.
- **Discriminating test:** `--task mapRasterProbe --workers 1`.
- **Status:** Refuted. Tek worker görevi 2,9 saniyede aynı stack ile çöktü.

# 5) Mechanism

1. `storyMapRasterEnsure`, özellik kapalıysa bilinçli olarak null döndürüyor (`js/StoryMapRaster.js:393-394`).
2. `storyNewCampaign`, özelliklerden bağımsız olarak altıgen altyapıyı sıfırlıyor (`js/Story.js:528`).
3. `storyHexInfrastructureSegmentsEnsure`, altıgen coğrafyayı istiyor (`js/StoryHexRoads.js:577`).
4. `storyHexGeographyEnsure`, null kontrolü yapmadan rasterı source hash’e veriyor (`js/StoryHexGeography.js:350-353`).
5. Hash üretici `raster.sourceHash` okumasında çöküyor (`js/StoryHexGeography.js:62`).

- **Root cause:** Kanonik rasterın özellik sözleşmesi ile altıgen coğrafyanın zorunlu türetim bağımlılığı arasında uyumluluk adaptörü olmaması.
- **Contributing factor:** Altıgen sistemleri eklendiğinde eski özellik-kapalı A/B yolu tam paketle kapılanmadı.
- **Detection failure:** `mapRasterProbe` manifestte bulunuyor fakat uzun paralel pakette geç çalıştığı için daha önceki semantik hata bu sonucu gizledi.
- **Weakest link:** Regresyonun ilk başarısız commit’i bisect edilmedi; mevcut mekanizma doğrudan kanıtlıdır.

# 6) Remediation Options

## Mitigation

- **Title:** Altıgen altyapı resetini raster kapalıyken atlamak
- **Category:** Mitigation
- **Severity:** Medium
- **Confidence:** Likely
- **Location:** `js/Story.js:528`
- **Evidence:** Çöküşü önler fakat altıgen türetimleri eksik bırakır.
- **Why it matters:** Kampanya açılır ancak A/B dünya eşitliği bozulabilir.
- **Recommended fix:** Uygulama; yalnız acil çöküş bastırması olur.
- **Tradeoffs / Risks:** Alt sistemlerin sessizce kaybolması.

## Fix

- **Title:** Altıgen coğrafya için kalıcı olmayan raster fallback’i sağlamak
- **Category:** Fix
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `js/StoryHexGeography.js`
- **Evidence:** Altıgen coğrafya raster verisine gerçekten ihtiyaç duyuyor; düşük seviye `storyMapRasterCreate` kanonik nesneyi `STORY` içine yazmadan aynı deterministik kaynağı üretebiliyor.
- **Why it matters:** Doğrudan raster API kapalı kalırken yeni altıgen dünya aynı fiziksel türetimleri korur.
- **Recommended fix:** Yalnız kanonik özellik kapalıyken transient raster oluşturup kaynak hash’iyle önbellekle; coğrafya resetinde bu cache’i temizle.
- **Tradeoffs / Risks:** Kapalı A/B başlatmada bir kerelik raster üretim maliyeti; cache bunu tekrar maliyetinden korumalı.

## Prevention

- **Title:** Özellik-kapalı kampanyayı yeni fiziksel katmanlarla birlikte kapılamak
- **Category:** Prevention
- **Severity:** Low
- **Confidence:** Confirmed
- **Location:** `tests/story-world.test.js:5393-5394`
- **Evidence:** Mevcut assertion null raster sözleşmesini koruyor; kampanya açılışı daha önce çöktüğü için ona ulaşamıyor.
- **Why it matters:** Gelecekte yeni raster tüketicileri aynı sözleşmeyi bozamaz.
- **Recommended fix:** Mevcut `mapRasterProbe` assertionlarını koru ve transient fallback’in kanonik `STORY.canonicalMapRaster` alanını doldurmadığını doğrula.
- **Tradeoffs / Risks:** Yok.

# 7) Verification Plan

- `node tools/story-test-parallel.js --task mapRasterProbe --workers 1` başarıyla bitmeli.
- Sonuçta `disabled.raster === null`, `disabled.diagnostics.disabled === true` ve açık/kapalı dünya hash’leri eşit kalmalı.
- `node tests/story-hex-world.test.js` ile normal altıgen coğrafya sözleşmesi doğrulanmalı.
- Son olarak `npm test` baştan sona geçmeli.
- Tekrar belirtisi: özellik kapalı kampanya açılışında null alan okuması veya kanonik rasterın istemeden `STORY` içine yazılması.
