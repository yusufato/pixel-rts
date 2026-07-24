# README-PATCH — Hologram Harita v2: EKSİKSİZ entegrasyon (Claude Code için)

Önceki entegrasyon geoData'yı yalnız **kara maskesi** olarak kullandı; dağ/nehir/deniz/şehir
görselleri/yol/fabrika/kışla/maden çizimi HİÇ yazılmadı, şehir 50'de kaldı, dünya 3000px kaldı.
Bu paket bunların TAMAMINI kod olarak içerir. **Spec değil — dosyalar commit'lenir.**

## Dosyalar (bu paketten repoya)
1. `tools/make-geodata.js` → **üzerine yaz** (v2: 120 şehir + maden + tam yol grafı + 1.5× çözünürlük)
2. `js/StoryGeoRender.js` → **yeni dosya**
3. Sonra çalıştır: `node tools/make-geodata.js` → `js/geoData.js` v2 yeniden üretilir (~500 KB)

## index.html — script sırası
```html
<script src="js/StoryRender.js"></script>
<script src="js/StoryGeoRender.js"></script>   <!-- YENİ: hemen SONRASINA -->
```
`StoryGeoRender.js` `storyRender`'ı yeniden tanımlar (son tanım kazanır). `STORY._geoMap=true`
ve `GEO` yüklüyse yeni akış, değilse ESKİ davranış birebir çalışır (güvenli geri dönüş).

## Story.js — storyBuildCities değişikliği (TEK yer)
`storyBuildCities()` başına:
```js
const seeded = (typeof storyGeoSeedNodes === 'function') ? storyGeoSeedNodes() : null;
if (seeded) {
    const nodes = seeded;
    for (const e of storyGeoRoads()) { nodes[e[0]].neighbors.push(e[1]); nodes[e[1]].neighbors.push(e[0]); }
    // sahiplik zaten c.st'den geldi; başkentler = tier 3 şehirler (devlet sırasıyla)
    STORY._capitals = [];
    for (let s = 0; s < STORY_STATE_DEFS.length; s++) {
        const cap = nodes.find(n => n.owner === s && n.level === 3) || nodes.find(n => n.owner === s);
        STORY._capitals[s] = cap ? cap.id : 0;
    }
    for (const capId of STORY._capitals) { const c = nodes[capId]; if (c) { c.fac = Math.max(1, c.fac); c.bar = Math.max(1, c.bar); c.garrison = Math.max(2, c.garrison); } }
    return nodes;
}
```
- **Gerçek şehir adları:** `storyGeoSeedNodes` her düğümün `names` önbelleğini 8 devlet için
  gerçek adla doldurur → `storyCityRename` no-op olur, adlar hep gerçek kalır (Ankara, Berlin…).
- **K-en-yakın komşuluk KULLANILMAZ** — graf `GEO_ROADS`'tan gelir (gerçek koridorlar +
  K-2 + bileşen bağlama build adımında yapıldı).
- Yatak ataması: `oil`/`pts` zaten şehirde geliyor → `storyAssignDeposits` çağrısı geo modunda atlanmalı
  (ya da içinde `if (STORY._geoMap) return;`).

## storyBuildLandGrid (StoryRender.js) — 1.5× dünya
Geo dalındaki `STORY_WORLD_W = 3000` satırını `4500` yap (StoryGeoRender de render'da zorlar;
grid dalıyla tutarlılık için kaynağı da güncelle).

## Ne çizilir (hepsi StoryGeoRender.js'te hazır)
- **Deniz yapısı:** derinlik gradyanı + dalga dokusu + kıyı sığlık bandı (çift stroke)
- **Dağlar:** GEO.ranges hillshade · **Nehirler:** GEO.rivers · **Çöl/boreal kuşaklar**
- **Şehir görseli:** `n.level`'e göre 2/4/6 pixel bina + amber pencereler + sahip-rengi kare
- **Fabrika:** `n.fac` kadar baca · **Kışla:** `n.bar` yeşil flama ·
  **Petrol:** `n.oil` derik · **Maden:** `n.pts` yeşil kazma — HEPSİ CANLI node verisinden
  (oyuncu fabrika kurunca baca haritada anında belirir)
- **Yollar:** canlı `n.neighbors` grafından, zoom-LOD alfası (uzak .22 / orta .5 / yakın .8)
- Kuşatma/komutan jetonu/nabız/SELECT/CMD: orijinal davranış birebir korundu.

## Doğrulama listesi (entegrasyon sonrası)
- [ ] Yeni Hikaye → harita gerçek kıyılar + dağ/nehir/çöl görünür (düz yeşil DEĞİL)
- [ ] 120 şehir, GERÇEK adlar (yan panelde de)
- [ ] Şehirlerde bina kümeleri; fabrika kur → baca sayısı artar
- [ ] Yollar görünür, zoom'da belirginleşir; komutan yalnız yol komşusuna gider
- [ ] Petrol derik / maden kazma ikonları ilgili şehirlerde
- [ ] Dünya 1.5× (4500px) — kamera gezinme aynı
- [ ] Eski kayıt yükleme: `STORY._geoMap` yoksa eski görünüm bozulmadan çalışır
