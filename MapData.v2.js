# Gerçekçi Arena Arazileri — Claude Code Handoff

Kaynak tasarım: `Savaş Arenaları - Gerçekçi Arazi.dc.html` (tarayıcıda aç → 10 arenayı gör).
Bu paket **spec + veri**; tasarım dosyası üretime taşınmaz, hedef görüntüdür.

## Dosyalar
- `MapData.v2.js` — 10 arenanın tam arazi verisi (dünya-uzayı, 3400×2300). Doğrudan commit'lenebilir.
- Bu dosya — renderer + sim entegrasyon spec'i.

## Kural
`terrainFeatures` (daire listesi) **sim'in tek arazi girdisi olmaya devam eder**. Yeni tipler
render + geçilmezlik maskesinden türetilir → AI, LOS, örtü, MP lockstep ve eski kayıtlar bozulmaz.
V2 verisi yoksa tüm tablolar ×1.0 döner (nötr fallback).

## 1) Veri → sim köprüsü
`applyMap(id)`:
1. `ARENAS_V2[id]` oku, `terrainFeatures.length = 0`.
2. `ridges` → `{x,y,r:max(rx,ry)*0.85,type:MOUNTAIN,seed}`, `forests` → `{...,type:FOREST}`,
   `rocks` → MOUNTAIN (küçük r), `villages` → FOREST benzeri örtü dairesi (AI için "değerli savunma").
3. `decorateTerrain(terrainFeatures)` + `refreshSimTerrainCaches()` — mevcut çağrılar aynen.
4. `currentElevSeed = 7919 * (id + 1); _elevDirty = true;`
5. `bakeArenaTerrain(id)` → doku + tip maskesi (aşağıda).

## 2) TerrainRender.js — bake pipeline (bir kez, ~1–1.5 sn)
1. **Yükseklik alanı** — `ridges` elipsleri (rx/ry/rot) + domain-warped fBm; 50px grid.
2. **Biyom bantları** — yükseklik + biyom paleti: `ova` `#526344/#4d603d/#425438`,
   `yayla` `#6a6a55/#5b5f4c/#4a4b3d`, `batak` `#405039/#37472f/#2b3a2a`, `bozkir` `#7a6f4a/#6a6244/#5a5338`.
   (Mevcut `tilePalette` bu setin `ova` hâli.)
3. **Hillshade** — KB güneş, gradyan tabanlı gölge çarpanı.
4. **Kontur çizgileri** — mevcut `bakeTerrainElevation()` marching-squares'i aynen, `rgba(125,95,42,.5)`.
5. **Su ağı** — `river`/`creeks` polyline → banka + su + parlama; `bridges`/`fords` maskede geçilebilir.
6. **Kültürel katman** — `fields` (çizgi dokusu + çit), `roads`/`rails` (koyu kılıf + açık dolgu + travers), `villages` (bina kümesi + gölge).
7. **Vejetasyon** — orman kademesi: `dist < r*0.62` sık taç (`#183f25`), dışı açık koru (`#205532`).
8. **Tip maskesi** — `Uint8Array(WORLD/8 × WORLD/8)`, her hücre TERRAIN tipi → `terrainAt(x,y)`.
9. **Blit** — her karede tek `drawImage` (mevcut `groundCanvas` deseni).

## 3) Sim etkileri (tablolar)
| Etki | Kanca | Değişiklik |
| --- | --- | --- |
| Tip tanımı | `globals.js TERRAIN` | `MARSH:5, ROCK:6, URBAN:7, FIELD:8, ROAD:9` + `terrainAt(x,y)` tek okuma noktası |
| Hız | `Unit.js` hız hesabı | bataklık paletli 0.5 / tekerlekli 0.35 · çamur 0.7 · sık orman 0.75 · yol 1.25 · tarla 0.95 · köy 0.8 (araç 0.6) |
| Örtü | `BattleRules.js` gelen hasar | sık orman 0.75 · açık koru 0.88 · kaya 0.6 · köy 0.6 · tarla 0.9 (yalnız piyade) · kuru dere 0.8 |
| Geçilmezlik | `MapImage.js isPassableAt` | nehir (köprü/geçit hariç), kaya, sırt çekirdeği; `nearestPassable` zaten kullanılıyor |
| LOS | `globals.js checkLineOfSight` | maske ışın-taraması (`gridLOSBlocked` deseni); açık koru yarı-keser, pusu mesafesi `AMBUSH_DETECT*0.7` |
| Yükselti | `globals.js elevationAt` | mesafe elips uzayında (rx/ry/rot); zirve +görüş/+menzil zaten `Unit.js:542/617` |
| Siper | `Unit.js buildTrenchTarget` | bataklık/su/kaya'da kazılamaz; demiryolu dolgusu + kuru dere = hazır siper (bake'te statik `trenches`) |
| Köprü onarımı | `BattleRules.js` + ENGINEER | `{broken:true, repair:0..1}`, temasta `repair += dt/12`, 1.0 → maske geçilebilir (sim-tick tabanlı, `Math.random` yok) |
| AI cache | `AI.js refreshSimTerrainCaches` | marsh = kaçınılacak, urban = savunma değerli; `deployMatrix` aynen |

## 4) Mevsim varyantı
`season: 'yaz' | 'sonbahar' | 'kis'` — yalnız bake'te palet/overlay: sonbahar çamur lekeleri +
doygunluk düşer (çamur alanları hız ×0.7), kış kar lekeleri + nehir buz (buz = geçilebilir ama
zırhlıya kırılma riski istenirse ayrı adım). Gameplay maskesi değişmez.

## 5) Sıra (her adım tek başına test edilebilir)
1. TERRAIN enum + `terrainAt()`
2. hız / örtü tabloları
3. geçilmezlik maskesi + LOS
4. köprü / onarım olayı
5. AI cache tazeleme

## Doğrulama listesi
- [ ] 10 arena `applyMap(0..9)` ile yükleniyor, kamera/tıklama isabeti doğru
- [ ] Sırtlar rölyefli + konturlu, kaya çıkıntıları zırhlıya kapalı
- [ ] Nehir yalnız köprü/sığ geçitten geçiliyor; yıkık köprü istihkamla açılıyor
- [ ] Bataklıkta hız yarıya iniyor, siper kazılamıyor
- [ ] Orman kenarı yarı örtü, çekirdek tam gizlenme (pusu çalışıyor)
- [ ] Köy bloklarında piyade üstün, tank görüşü kısıtlı
- [ ] 3 kontrol noktası (880/1700/2520, y=1150) araziden açık
- [ ] Ayna arenalarda iki taraf birebir simetrik; 8–9 kasıtlı asimetrik
- [ ] Bake tek seferlik, kare başına tek blit; eski kayıtlar (V2 verisi yok) bozulmuyor
