# RCA — README harita cache sözleşmesini anlatıyor fakat kaynak dosyayı adlandırmıyor

## 1) Verdict

- **Root cause:** README'nin harita bölümü yeniden yazılırken merkezî API ve scope'lar korundu, fakat bu sözleşmenin sahibi `js/StoryMapCache.js` adı metinden düştü.
- **Confidence:** Confirmed.
- Assertion bayat değildir: aktif/arşiv kaynak ayrımının amacı, geliştiricinin yanlış renderer/cache dosyasını düzenlemesini önlemektir.

## 2) Failure Definition

- Beklenen: Kök README hem merkezî cache kapısını hem de bu kapının aktif kaynak dosyasını açıkça göstermeli.
- Gerçek: `storyInvalidateMapCaches(scope, reason, details)` ve altı scope ayrıntılı anlatılıyor; `StoryMapCache.js` adı yok.
- Etki: Yeni geliştirici API'yi arayarak bulabilir ama kanonik dosya sahipliği ve index yükleme mimarisi README'den anlaşılmaz.
- Blast radius: README harita cache sözleşmesi giriş cümlesi.

## 3) Evidence

- README `## Harita cache sözleşmesi` altında bütün scope'ları ve RAM bitmap davranışını içeriyor.
- `rg` kök README'de `StoryMapCache` eşleşmesi bulmuyor; kanonik durum/ana plan dosyanın sahipliğini açıkça yazıyor.
- `index.html` aktif yükleme sırasında `StoryPoliticalOverlay.js → StoryMapCache.js → StoryRender.js` sırasını koruyor.
- Diğer assertion hedefleri `3000`, aktif `js/MapData.js` ve arşiv `StoryGeoRender.js` README'de mevcut.

## 4) Hypotheses

1. **Belge reorganizasyonunda dosya adı atlandı.** Supported.
2. **Cache kaynağı artık başka dosyaya taşındı.** Refuted: index ve runtime API hâlâ `js/StoryMapCache.js` kullanıyor.
3. **Kök README bu ayrıntıyı taşımamalı.** Refuted: aynı bölüm aktif renderer, taktik MapData ve arşiv prototip sahipliğini zaten bilinçli olarak açıklıyor.
4. **Assertion yalnız eski metin biçimine bağlı.** Refuted: regex sadece kanonik dosya adını arıyor, paragraf düzenini zorlamıyor.

## 5) Remediation

- Harita cache sözleşmesi girişine `js/StoryMapCache.js`in `storyInvalidateMapCaches` tek kapısının sahibi olduğunu belirten tek cümle ekle.
- Mevcut scope açıklamalarını ve belge haritasını değiştirme.

## 6) Verification Plan

- README `StoryMapCache.js`, `3000`, aktif `js/MapData.js` ve arşiv prototip ayrımlarını birlikte geçmeli.
- Index yükleme sırası assertionı korunmalı.
- Sıralı assertion ve tam paket geçmeli.