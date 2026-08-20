# 3D RENDER KATMANI — sim ↔ render sözleşmesi

**Amaç:** savaş motoru 2D ve deterministik kalırken, üstüne bağımsız bir WebGL/Three.js
görüntü katmanı kurmak. Bu belge, 3D tarafını yazan kişinin **simülasyon dosyalarına hiç
dokunmadan** çalışabilmesi için neyin nereden okunacağını tanımlar.

**Bu belge kod değil, kısıt listesidir.** Tek bir kural her şeyin üstünde:

> **3D katmanı simülasyona YAZMAZ.** Yalnız okur. Bir şeyin görünmesi için sim durumunun
> değişmesi gerekiyorsa, o şey 3D katmanında yapılmamalıdır.

---

## 0. Neden bu kural — ve bedeli ne kadar somut

Simülasyon "aynı tohum → aynı maç" garantisi veriyor. Bu garanti üç şeyi birden taşıyor:

| ne | nasıl bağlı |
|---|---|
| **İleri-bakış araması** | Dünyayı çatallayıp yeniden simüle ediyor. Ölçülmüş kazanç: ufuk 100→300 **+980**, derin 2→5 **+954**. Determinizm giderse bu katman komple ölür. |
| **Replay + online lockstep** | Aynı temele oturuyor (`npm run test:online`, negatif kontrollü). |
| **Bütün ölçüm altyapısı** | Eşleştirilmiş-tohum A/B. Aynı tohum aynı maçı vermezse `tools/rol-dengesi*.js`, kapılar, denge raporları — hepsi anlamsızlaşır. |

Yani "render katmanı sim'e yazmasın" bir üslup tercihi değil; projenin son üç günde
ölçtüğü kazançların hepsinin ön koşulu.

**İyi haber: ayrım kodda ZATEN var.** Kanıtlar:

- `spawnProjectile()` ilk satırı: `if (SIM.headless || !target) return;`
- `applyKnockback(...)` yanındaki not: *"namlu geri-tepmesi (render-only)"*
- `drawAngle` — `facingAngle`'a kademeli yaklaşan **çizim-tarafı** açı
- Hasar kuyruğu `SIM.pendingHits`'e **yalnız skaler** giriyor: *"canlı-referans YOK → fork/replay güvenli"*
- Çizim yalnız `js/main.js` içindeki `units.forEach(u => u.draw())` yolundan çağrılıyor;
  headless tezgâh (`tools/muharebe-tezgah.js`) bu yolu **hiç** çalıştırmıyor.

3D katmanı bu ayrımın doğru tarafına eklenir: yeni bir "draw" arka ucu.

---

## 1. Sayılar

| ne | değer |
|---|---|
| dünya boyutu | **5100 × 3450** px (`WORLD_W`, `WORLD_H`) |
| tik | **50 ms → 20 Hz** (`BATTLE_TICK_MS = 50`) |
| birim sayısı | taraf başına en çok **48**, yani sahnede ~96 |
| mermi görsel tavanı | 400 (`projectiles`) |
| parçacık tavanı | 1500 (`particles`) |
| mevcut sprite atlası | `icons.png` **9130 × 730**, hücre 320×320, pad 30 → **26 sütun**, satır 0 mavi / satır 1 kırmızı |

⚠ `Oyun tasarımı planı/design_handoff_war_room/README.md` atlası "3000×530 / 9 sütun"
diye yazıyor — **bayat**. Ölçüyü koddan al (`js/globals.js` `SP_W/SP_H/SP_PAD`).

**Ölçek notu:** ~96 birim, instancing için küçük bir sayı. Asıl yük birimler değil
**efektler** olacak (mermi izleri, patlama, toz, enkaz). LOD'u önce oraya kur.

**Ana iplik büyük ölçüde boş:** AI araması zaten Web Worker'a taşındı — ölçülmüştü,
kare donması **4432 ms → 37 ms**. Yani 3D render ana ipliği rakipsiz kullanır. Bu, bu
proje için alışılmadık bir lüks; hesabını buna göre yapabilirsin.

---

## 2. Birimden okunacak alanlar (hepsi hazır)

`SIM.units` dizisi. Her birim:

| alan | anlam |
|---|---|
| `x`, `y` | dünya konumu (px) |
| `facingAngle` | **sim** yönü (radyan, +x sağ). Hareket yönü ya da hedef yönü |
| `drawAngle` | **çizim** yönü — `facingAngle`'a `UNIT_TURN_RATE[type] × UNIT_TURN_SMOOTH` hızıyla yaklaşır. 3D gövde açısı için **bunu kullan**, `facingAngle`'ı değil |
| `elevation` | 0..1 arazi yüksekliği (`elevationAt(x,y)`, her tik güncelleniyor). 3D zemin bununla **aynı** yüzeyi kullanmalı yoksa araç havada/gömülü görünür |
| `type` | birim tipi indeksi → `STATS[type]` (menzil, hp, armorType, weapons, category, roleTags) |
| `isRed` | taraf |
| `hp` / `maxHp` | can — manga figür sayısı ve hasar görünümü için |
| `dead`, `abandoned`, `loaded` | ölü / terk edilmiş (tarafsız, ele geçirilebilir) / araca binmiş (çizilmez) |
| `suppression` | 0..1 bastırılma — çömelme/siperlenme animasyonu için |
| `selected` | oyuncu seçimi |
| `ammo` / `maxAmmo` | mühimmat |
| `combatState` | metin durum ("READY", "Gözcü Yok", "Cephanesiz"...) |
| `id` | kalıcı kimlik — **deterministik varyasyon** üretmek için kullan (aşağı bak) |

### Henüz olmayan, 3D'nin isteyeceği alan

`turretAngle` **yok**. Gövde ve taret şu an tek açı. Eklenmesi kolay ve **render-only**
olmalı: hedef kerterizine kendi dönüş hızıyla yaklaşan ikinci bir açı. Sim'e sokma
(ateşi taret hizasına bağlamak oynanışı değiştirir → ölçüm kapısı gerektirir).
İstenirse ben ekleyebilirim; `drawAngle` ile aynı desende.

---

## 3. Atış / patlama olayları — zamanlaması hazır ve tam

En değerli parça bu. `SIM.pendingHits` kuyruğu, mermi **fırlatıldığı anda** doluyor ve
**varış tikini** baştan biliyor. Yani muzzle flash → mermi yayı → çarpma senkronu
tahmin gerektirmiyor; kuyruktan okunur.

```js
{ kind: 'direct' | 'blast',
  evt: 'DIRECT_FIRE' | 'ARTILLERY_SPLASH',
  fireTick, arriveTick, seq,
  atkId, atkType, atkIsRed, atkX, atkY,      // atıcı ve fırlatma noktası
  tgtId, dmg,                                 // direct: hedef birim
  cx, cy, blastR, suppR,                      // blast: çarpma NOKTASI + yarıçap
  killTick, killX, killY,                     // havada önlendiyse: düşürülme anı+noktası
  isCrit, isRear, isFlank, splashR }
```

Bunun anlamı:

- **Namlu alevi**: `fireTick`, `atkX/atkY`, `atkType`
- **Mermi uçuşu**: `fireTick → arriveTick` arası enterpolasyon (hız zaten
  `battleProjectileSpeed(type, targetIsAir)`; VFX ile **aynı** hız kullanılıyor)
- **Çarpma**: `arriveTick`, `cx/cy` (blast) veya hedefin o anki konumu (direct)
- **Havada önleme**: `killTick/killX/killY` — roket yolun ~%60'ında düşürülür, orada sön
- **Yön/kritik vuruş**: `isRear` / `isFlank` / `isCrit` → farklı çarpma efekti,
  ve zırh-yönü modeli **görsel olarak da** okunur hale gelir

Mevcut 2D VFX kancaları aynı verilerle çalışıyor; 3D katmanı bunları taklit edebilir:
`spawnProjectile(x1,y1,target,opts)` · `spawnExplosion(x,y,scale)` · `spawnHitSparks(x,y)` ·
`decals.push({x,y,type:'track',size,angle,alpha})` (palet izi zaten üretiliyor).

---

## 4. Arazi

| ne | nerede |
|---|---|
| yükseklik alanı | `elevationAt(x, y)` → 0..1, `js/globals.js` |
| arazi tipleri | `TERRAIN = { NONE, FOREST, MOUNTAIN, HILL, WATER, MARSH, ROCK, URBAN, FIELD, ROAD }` |
| yerleşim | `terrainFeatures[]` — `{ type, x, y, r }` |
| ızgara | 150 × 100 hücre (dünya 5100×3450 üzerinde) |

3D zemin **`elevationAt` ile birebir aynı** yüzeyi üretmeli. Farklı bir yükseklik haritası
kullanılırsa araçlar zemine oturmaz ve daha kötüsü: oyuncunun gördüğü tepe ile hasar
hesabındaki tepe farklı olur (yükselti hasarı etkiliyor: yüksekten +%28'e kadar, yokuş
yukarı −%20'ye kadar).

---

## 5. Determinizm kuralları — 3D katmanının uyacağı

1. **Sim'e yazma yok.** `SIM.*`, birim alanları, `srand()` — hiçbirine dokunma.
   Render-only alan eklemek serbest, ama adı `_` ile başlasın ve **yalnız `draw`
   yolunda** yazılsın (örnek: bu turda eklenen `_solaBakiyor`).
2. **`Math.random()` serbest, `srand()` YASAK.** `srand` simülasyonun tohumlu üretecidir;
   render'dan bir kez çağırmak bütün maçı kaydırır. Görsel varyasyon için ya
   `Math.random()` (sim'e girmediği kesinse) ya da **birim kimliğinden türetme** kullan:
   ```js
   const h = ((unit.id * 2654435761 + i * 40503) >>> 0);   // sabit, tohumdan bağımsız
   ```
3. **Zamanlama sim tikinden gelir**, `performance.now()`'dan değil. Kare hızı 144 olsa da
   sim 20 Hz; ara kareler **enterpolasyon**dur. Enterpolasyon sonucu sim'e geri beslenmez.
4. **Headless yol korunmalı.** `tools/muharebe-tezgah.js` (jsdom) render çağırmıyor;
   3D katmanı da o yolda **hiç yüklenmemeli**. Kapılar bu yüzden 13× hızlı koşuyor.

---

## 6. Kabul kapıları (3D katmanı bunlardan geçmeli)

| kapı | ölçüt |
|---|---|
| **Determinizm** | Aynı tohum, 3D açık ve kapalı → maç sonucu **byte-aynı**. `tools/rol-dengesi.js` ile aynı tohumda iki koşu, marj/süre/kazanan birebir. |
| **Replay** | `npm run test:online` (lockstep, negatif kontrollü) geçmeli. |
| **Headless hız** | `tools/muharebe-tezgah.js` maç süresi değişmemeli (3D hiç yüklenmediği için değişmemeli — değişirse bir yerden sızmış demektir). |
| **Kare hızı** | 96 birim + tam efekt yükünde hedef FPS. Ölçüm sahnesi: `--izle` seyirci kipi. |
| **Okunabilirlik** | Uzman haklı: prototip **tank + piyade + topçu**. Eğik kamerada birim tipi ve TARAF anında ayırt edilebilmeli. Bu 2D'de sprite+renk ile bedavaydı; 3D'de bedava değil. |

---

## 7. Bu turda 2D tarafında yapılanlar (3D gelene kadar oyunda)

- **Yön çevirme.** `icons.png` yandan çizilmiş ve hücrelerin **tamamı sağa bakıyordu**;
  çizim kodunda hiçbir yerde yatay çevirme yoktu. Yani sola yürüyen tank namlusunu geriye
  tutuyordu. Histerezis eşikli (`UNIT_FLIP_ESIK = 0.25`) yatay çevirme eklendi — dikeye
  yakın açıda sprite titremesin diye.
- **Manga çizimi.** Yaya birimler (`armorType === 'infantry'`) artık **N figür** çiziliyor,
  sayı can oranından. Simülasyon yine tek birim — askerleri ayrı varlık yapmak varlık
  sayısını ~5× artırır ve ileri-bakış aramasının maliyetini aynı oranda katlar.

İkisi de render-only; headless yolda hiç çalışmaz. 3D katmanı geldiğinde ikisi de emekli
olur, ama o zamana kadar oynanan oyun bunlar.

---

## 8. Uzmanın listesine eklenecek üç şey

1. **Ana iplik boş** (arama Worker'da) — render bütçesi göründüğünden geniş.
2. **`SIM.pendingHits` zaten fırlatma/varış tikini taşıyor** — mermi yayı ve çarpma senkronu
   için ayrı bir olay sistemi yazmaya gerek yok, kuyruk okunur.
3. **`elevationAt` ile zemin birebir eşleşmeli** — yükselti hasar hesabına giriyor, görsel
   zemin farklı olursa oyuncu yanlış tepe okur.
