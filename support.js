repo: yusufato/pixel-rts
branch: main
path: js/, tools/, gercekci-harita.html

## Last sync
date: 2026-07-27T00:00:00Z

### Updated in this project
- `js/geoData.js` içe alındı (Natural Earth 110m → 1500×1180 piksel uzayı): GEO.land/rivers/ranges, GEO_CITIES (152 şehir, tier/fac/mine/oil), GEO_ROADS (71 kenar).
- `Harita 2.5D.dc.html` eklendi: veri uzayı üzerine prosedürel yükseklik alanı (kıyı eğimi + fBm + bağlı dağ sırtları + nehir vadileri), sınırlı paletli pixel-art biyom render'ı, hillshade, batimetri.
- 28 düzensiz province + 3 devlet siyasi renk ailesi (kara parçasına kilitli atama), yerleşim/fabrika/maden/petrol/yol katmanı veri alanlarından.
- Mode-7 şerit warp ile zoom'a bağlı kamera (uzak 90° → yakın ~45°), yakın zoomda yükseklik alanından mikro kabartma; 4 tweak (kamera eğimi, arazi dramı, siyasi renk gücü, palet ruhu).

## Screen map
| Screen | Repo files |
| --- | --- |
| Harita 2.5D.dc.html | js/geoData.js, tools/make-geodata.js, README.md |

## Sync history
- 2026-07-25: ilk okuma (README, index.html, tools/make-geodata.js, gercekci-harita.html) ve js/geoData.js kopyası.
