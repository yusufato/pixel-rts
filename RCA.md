# RCA — ImageData bayrağı kapalı testi HXD politik canvasından önceki fallbacki bekliyor

## 1) Verdict

- **Root cause:** `politicalOverlayProbe` bayrak-kapalı assertionları, `render.imageDataPoliticalOverlay` kapatılınca `storyEnsureOwnerOverlay()` çağrısının doğrudan eski `300×236` hücre-başı `fillRect` yoluna düşeceğini varsayıyor. HXD-5 sonrasında fonksiyon önce bağımsız `hex-political-overlay-canvas-1` adaptörünü kullanıyor; yalnız ImageData üreticisi kapanıyor.
- **Confidence:** Confirmed.
- Güvenli fallback artık eski fillRect döngüsü değil, kanonik 1640×1290 HXD politik canvasıdır.

## 2) Failure Definition

- Beklenen: Bayrak-kapalı probu ImageData üreticisinin kapanmasını, doğrudan canvasın null kalmasını ve canlı renderın geçerli HXD politik canvas üzerinden sürmesini doğrulamalı.
- Gerçek: Bu davranış runtime'da oluşuyor fakat test 300 px ve 10.000+ fillRect çağrısı bekliyor.
- Etki: Eski yavaş fallbackin artık çalışmaması regresyon sayılıyor; HXD öncelik zinciriyle test sözleşmesi çelişiyor.
- Blast radius: `tests/story-world.test.js` içindeki iki bayrak-kapalı boyut/çağrı assertionı.

## 3) Evidence

- Kayıtlı çıktı: `diagnostics.disabled=true`, `directCanvas=null`, `hexDiagnostics.adapterVersion=hex-political-overlay-canvas-1`, render `1640×1290`, `fillRectCalls=0`, `putImageDataCalls=0`.
- `storyEnsureOwnerOverlay()` sırası HXD canvas → ImageData politik overlay → legacy fillRect fallback biçimindedir.
- HXD tanılaması 7.517 atanmış hücre ve 460 sınır kenarını doğruluyor.
- Dünya A/B karması eşit; bayrak kapalı yol dünya durumunu değiştirmiyor.

## 4) Hypotheses

1. **Test HXD öncelik zincirinden önce kalmış.** Supported.
2. **ImageData özellik bayrağı HXD katmanını da kapatmalı.** Refuted: bayrak adı ve API yalnız `political-overlay-rgba` üreticisini kapsıyor; HXD ayrı adaptördür.
3. **Bayrak kapalıyken politik katman tamamen yok oluyor.** Refuted: HXD diagnostics ve 1640 canvas mevcut.
4. **Legacy fillRect maliyet kapısı korunmalı.** Refuted: sevk edilen fallback artık o yol değildir; ölü/yedek yola performans başarısızlığı zorunlu tutulamaz.

## 5) Remediation

- Bayrak-kapalı render genişliğini `1640` olarak doğrula.
- `fillRectCalls` beklentisini `0` yap; HXD politik canvas eski hücre-başı fillRect döngüsünü çalıştırmamalı.
- `putImageDataCalls === 0`, ImageData disabled, directCanvas null, HXD adaptör/hücre/sınır ve A/B nötrlük kapılarını koru.
- Legacy fallback kodunu bu görevde silme.

## 6) Verification Plan

- Bayrak-kapalı bütün politik overlay assertionları güncel öncelik zinciriyle geçmeli.
- HXD `1640×1290`, 7.517 hücre, 460 sınır ve sıfır fillRect doğrulanmalı.
- ImageData direct canvas null ve putImageData sıfır kalmalı.
- Sıralı assertion ve tam paket geçmeli.