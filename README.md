# README-PATCH — Gerçekçi Avrupa Haritası v3 (Claude Code için)

Onaylanan görsel yön: **`gercekci-harita.html`** (bu pakette; tarayıcıda açıp hedefi gör).
Rölyefli gerçek coğrafya + gerçek şehir dokusu + modern tesis görselleri.
**Spec değil — buradaki dosyalar doğrudan commit'lenir.**

## Uygulama (3 adım)
1. `tools/make-geodata.js` → **üzerine yaz** (v2: 120 şehir, maden yatakları, tam yol grafı, 1.5× çözünürlük)
2. `js/StoryGeoRender.js` → **yeni/üzerine yaz** (v3: gerçekçi render)
3. `node tools/make-geodata.js` → `js/geoData.js` yeniden üretilir

`index.html`:
```html
<script src="js/StoryRender.js"></script>
<script src="js/StoryGeoRender.js"></script>   <!-- hemen SONRASINA -->
```
`StoryGeoRender.js` `storyRender`'ı yeniden tanımlar. `STORY._geoMap=true` + `GEO` varsa yeni
akış; yoksa ESKİ davranış birebir korunur (güvenli geri dönüş, eski kayıtlar bozulmaz).

## Story.js — `storyBuildCities()` başına
```js
const seeded = (typeof storyGeoSeedNodes === 'function') ? storyGeoSeedNodes() : null;
if (seeded) {
    const nodes = seeded;
    for (const e of storyGeoRoads()) { nodes[e[0]].neighbors.push(e[1]); nodes[e[1]].neighbors.push(e[0]); }
    STORY._capitals = [];
    for (let s = 0; s < STORY_STATE_DEFS.length; s++) {
        const cap = nodes.find(n => n.owner === s && n.level === 3) || nodes.find(n => n.owner === s);
        STORY._capitals[s] = cap ? cap.id : 0;
    }
    for (const capId of STORY._capitals) { const c = nodes[capId]; if (c) { c.fac = Math.max(1, c.fac); c.bar = Math.max(1, c.bar); c.garrison = Math.max(2, c.garrison); } }
    return nodes;
}
```
- Adlar **gerçek** kalır (`names` 8 devlet için ön-doldurulmuş → `storyCityRename` no-op).
- Yol grafı `GEO_ROADS`'tan gelir; K-en-yakın çalıştırma.
- `storyAssignDeposits` içine `if (STORY._geoMap) return;` (yataklar şehirle geliyor).
- `storyBuildLandGrid` içindeki `STORY_WORLD_W = 3000` → `4500`.

## Render katmanları (StoryGeoRender.js'te hazır)
1. **Arazi (bir kez üretilir, önbellek):** kara maskesi → chamfer mesafe → prosedürel
   **yükseklik alanı** (kıyı eğimi + fBm + GEO.ranges sırt bindirmesi) → **hipsometrik biyom**
   (ova yeşili → yayla → kayalık → kar; boreal / step / çöl karışımları) → **hillshade** (KB güneş).
2. **Deniz:** kıta sahanlığı → derin okyanus batimetri gradyanı + gürültü; kıyıda tortu şeridi.
3. **Vektör üstü:** nehirler (çift hat), iç sınırlar (kesikli), kıyı çizgisi, **cephe hatları** (kırmızı).
4. **Politik:** mevcut `storyEnsureOwnerOverlay()` aynen kullanılır → fetihte renk anında değişir.
5. **Yollar:** canlı `n.neighbors` grafı; koyu kılıf + açık dolgu, ana arter/tali, zoom-LOD alfası.
6. **Şehir:** yerleşim lekesi + sokak dokusu + gölgeli bina kümesi (kasaba 5 / büyük 10 / başkent 16
   + kule silueti + gece ışıkları), üstünde **sahiplik pini** (kare değil).
7. **Tesisler — canlı node verisinden:** `n.fac` modern fabrika (testere-dişli hangar + silolar +
   Sv.2 soğutma kulesi/duman + Sv.3 solar dizi), `n.bar` kışla (çit + flama), `n.oil` tanklar + derrick,
   `n.pts` açık ocak + headframe. Oyuncu fabrika kurunca harita anında değişir.

## Performans
- Arazi dokusu (4500×~3600) **bir kez** üretilir → `STORY._geoTerrain`. Üretim ~0.5–1.5 sn;
  ilk hikâye açılışında "ARAZİ VERİSİ İŞLENİYOR…" göstergesi eklemek iyi olur.
- Yükseklik/biyom hesabı 900px gridde yapılır, sonra yumuşak büyütülür — bellek ~65 MB.
- Her karede yeniden boyanan tek şey: sahiplik overlay'i (mevcut `_ownerKey` önbellek deseni).

## Doğrulama listesi
- [ ] Dağlar (Alpler/Karpatlar/Toroslar/Kafkas/Atlas) gölgeli sırt olarak görünüyor
- [ ] Nehirler (Ren, Tuna, Nil, Volga, Dinyeper…) çizili
- [ ] Deniz sığ→derin geçişli; Sahra kum, Kuzey boreal koyu yeşil
- [ ] 120 gerçek şehir, kutu değil bina kümesi; başkentlerde kule
- [ ] Fabrika kur → hangar/silo/duman haritada; kışla flaması, petrol derrick, maden ocağı
- [ ] Yollar kılıflı çiziliyor, zoom'da belirginleşiyor
- [ ] Dünya 4500px; kamera gezinme ve tıklama isabeti doğru
- [ ] `STORY._geoMap` kapalıyken eski görünüm bozulmadan çalışıyor
