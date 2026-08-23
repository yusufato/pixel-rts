# RCA — Politik overlay testi geri dönüş fallback çözünürlüğünü canlı katman sanıyor

## 1) Verdict

- **Root cause:** Kanonik harita raster testi, HXD-5 ile canlı politik katman `1640×1290` altıgen canvas'a taşındıktan sonra `renderCaches.overlay.width === 300` tarihsel Faz 14.2 beklentisini korudu.
- **Confidence:** Confirmed.
- `300` çözünürlük artık yalnız kıyı/ince-geometri kaybını ölçen bilinçli downsample teşhisidir; canlı owner overlay çözünürlüğü değildir.

## 2) Failure Definition

- Beklenen: Test gerçek render cache'inin güncel kanonik `1640` genişliğini ve ayrı 300 px downsample teşhisini kendi sözleşmeleriyle doğrulamalı.
- Gerçek: Runtime canlı `1640` canvas döndürüyor; assertion bunu eski geçici `300` değerine eşitliyor.
- Etki: Düşük çözünürlüklü politik katmanı kaldıran görsel iyileştirme sahte regresyon oluyor.
- Blast radius: `tests/story-world.test.js` içindeki tek render-cache genişlik assertionı; 300 px teşhis ve kıyı bütçeleri korunur.

## 3) Evidence

- `storyEnsureOwnerOverlay()` önce `storyHexPoliticalOverlayEnsureCanvas()` yolunu kullanıyor.
- Kanonik HXD belgeleri canlı politik canvas'ı `1640×1290`, `7.517` atanmış hücre ve `460` sınır kenarı olarak kabul etmiş.
- `StoryMapRaster.js` ortak raster genişliğini `1640` olarak sabitliyor.
- Harness ayrıca `mapRasterResample(300, ...)` ile yalnız karşılaştırma teşhisi üretiyor; `diagnostics.overlay300` ve ince-geometri kapıları bu amaçla ayrı kalıyor.

## 4) Hypotheses

1. **Canlı overlay 1640'a yükseldi, assertion bayat kaldı.** Supported.
2. **Runtime yanlışlıkla terrain rasterını overlay diye döndürüyor.** Refuted: kaynak HXD politik canvas adaptörü ve sahiplik checksum'larını taşıyor.
3. **300 px teşhisi tamamen kaldırılmalı.** Refuted: downsample kayıp ölçümü hâlâ yararlı ve canlı render yolundan ayrıdır.
4. **1640 performans regresyonu yaratıyor.** Refuted for this failure: HXD gerçek EXE kabulünde politik canvas ve toplam p95 bütçeleri belgelenmiş; test ayrıca cache duvar süresi kapısını koruyor.

## 5) Remediation

- Gerçek render cache genişliği assertionını `1640` yap ve HXD-5 kanonik politik canvas mesajıyla adlandır.
- 300 px resample, kıyı farkı ve ince geometri kaybı assertionlarını değiştirme.
- Performans kapısını gevşetme.

## 6) Verification Plan

- `renderCaches.overlay.width === 1640` geçmeli.
- `overlay.width === 300`, `overlay300.thinGeometryLostRatio < 0.02` ve kıyı farkı bütçesi geçmeli.
- `wallTimeMs < 2000` korunmalı.
- Sıralı assertion paketi ilerlemeli; tam paket geçmeli.