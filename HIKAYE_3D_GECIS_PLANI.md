# PIXEL RTS — HİKÂYE DÜNYASI 3D GEÇİŞ PLANI

**Plan kimliği:** `story-3d-transition-1`  
**Aktif karar fazı:** `HXD-9C`  
**İlk prototip alanı:** Marmara–Ankara koridoru  
**Motor adayı:** Three.js + WebGL2, mevcut Electron çalışma zamanı içinde  
**Temel ilke:** Simülasyon değişmez; yalnız sunum adaptörü değişir.

## 1. Neden 3D ve neyi çözmez?

Mevcut hareketli tır, tren ve gemiler gerçek fiziksel sevkiyatlara bağlıdır
fakat görsel olarak döndürülen 2D resimlerdir. Şehir, liman, orman, dağ ve
tesisler de atlas hücreleridir. 3D geçişin amacı bunları gerçek hacim, ışık,
yükseklik, animasyon ve kamera derinliğiyle göstermektir.

3D tek başına şu sorunları çözmez:

- eksik İstanbul–Ege/Karadeniz fiziksel koridorlarını oluşturmaz;
- simülasyonda bulunmayan fabrika, mahalle veya orduyu uydurmaz;
- ekonomi, karakter, lojistik veya savaş kararlarını daha akıllı yapmaz;
- kötü LOD, aşırı draw-call veya büyük dokuları otomatik optimize etmez;
- 2D görsel dosyayı düz bir plane üstüne koymak 3D kabul edilmez.

## 2. Pazarlıksız mimari ilkeler

1. `Story`, altıgen dünya, `PhysicalSiteV1`, `ShipmentV2`, yollar, stoklar ve
   karakter kayıtları tek mekanik otoritedir.
2. Renderer stok, sahiplik, konum, rota, hasar veya zaman yazamaz.
3. Her 3D nesne bir kanonik kimliğe geri çözülebilir: `cellId`, `nodeId`,
   `siteId`, `segmentId`, `shipmentId` veya gelecekte `actorId`.
4. Tır/tren/gemi fizik motoruyla rota aramaz. Konum ve yön, mevcut fiziksel
   segment + `stepProgressBps` değerinden türetilir.
5. Süspansiyon, tekerlek dönüşü, gemi yalpası, duman ve su izi yalnız görsel
   animasyondur; mekanik konumu değiştiremez.
6. 2D ve 3D kayıt biçimi aynıdır. Save içine kamera dışında renderer durumu
   yazılmaz; kamera tercihi de ayrı kullanıcı ayarıdır.
7. 2D ve 3D ağır dünya katmanları aynı anda bellekte tutulmaz.
8. Yerel model/doku kullanılır; CDN veya çevrim içi çalışma zamanı bağımlılığı
   yoktur. Halka açık EXE çevrim dışı aynı görünür.
9. 3D görünüm başarısız olursa tek ayar/başlangıç bayrağıyla 2D geri dönüşü
   mümkündür.
10. Güzel ekran görüntüsü kabul değildir; performans, kimlik eşliği, seçim,
    kayıt ve uzun süreli bellek kapıları birlikte geçmelidir.

## 3. Motor kararı

### 3.1 İlk aday: Three.js/WebGL2

Three.js mevcut Electron renderer sürecine doğrudan girer. HTML tabanlı HUD,
şehir/ekonomi/sohbet panelleri ve preload LLM köprüsü korunur. Bu nedenle ilk
karar prototipinde en düşük yeniden yazım riskidir.

Bağımlılık NPM'de kesin sürüme sabitlenecektir. İlk prototipte CDN yoktur.
WebGL2 kullanılır; WebGPU daha sonra ayrı karşı-test olabilir fakat ilk üretim
kapısı olmaz. Shader'lar mümkünse `compileAsync` ile kamera oyuncuya verilmeden
hazırlanır.

### 3.2 Neden şimdilik Unreal/Unity değil?

Tam motor göçü yalnız renderer değişikliği değildir. Electron UI, JavaScript
simülasyonu, kayıt/yükleme, jsdom test tezgâhı, yerel LLM köprüsü ve dağıtım
paketi yeniden bağlanır. Bu, harita 3D geçişinden büyük ayrı bir ürün projesidir.

Three.js düşük görsel kalite anlamına gelmez. Blender veya başka DCC araçlarında
üretilen gerçek GLB/glTF araç, şehir ve çevre modelleri; PBR materyaller, gölge,
LOD ve animasyonla kullanılabilir. Kaliteyi belirleyen motor adı değil model,
materyal, ışık ve optimizasyon hattıdır.

## 4. Çalışma zamanı mimarisi

```text
Kanonik simülasyon defterleri
        │ salt-okunur snapshot
        ▼
Story3DProjection
        │ render varlıkları + kimlik eşlemesi
        ▼
Story3DScene ── Terrain / Network / Settlement / Agent katmanları
        │
        ├── Story3DPicking ──► mevcut mapEntity ──► StoryUI
        └── Story3DTelemetry ─► frame/draw/triangle/VRAM teşhisi
```

Önerilen dosya sınırları:

- `Story3DBootstrap.mjs`: Three.js yükleme, WebGL2 yetenek kontrolü, yaşam döngüsü.
- `Story3DProjection.js`: kanonik kayıtlardan değişmez render snapshot'ı.
- `Story3DScene.js`: sahne, ışık, kamera, render döngüsü ve kaynak serbest bırakma.
- `Story3DTerrain.js`: altıgen arazi, yükseklik, kıyı, su ve biyom kümeleri.
- `Story3DNetworks.js`: yol, ray, liman ve inşaat/hasar görünümü.
- `Story3DSettlements.js`: şehir, ilçe ve `PhysicalSiteV1` modelleri.
- `Story3DAgents.js`: tır, tren, gemi ve daha sonra karakter seyahat araçları.
- `Story3DPicking.js`: raycast/instance kimliğini mevcut `mapEntity` sözleşmesine çevirir.
- `Story3DAssets.js`: GLB, materyal, doku, LOD ve dönem kataloğu.
- `Story3DTelemetry.js`: kabul ölçüleri ve context-loss teşhisi.

İlk prototipte dosyalar gereksiz yere parçalanmayacak; sınırlar test edilebilir
sorumluluk oluşunca ayrılacaktır.

## 5. Koordinat ve yükseklik sözleşmesi

- Kanonik altıgen dünyanın `centerX/centerY`, `q/r`, `radius`, `cellId` ve
  `layoutHash` değerleri değiştirilmez.
- Dönüşüm: simülasyon `x → Three X`, simülasyon `y → Three Z`, coğrafi
  yükseklik → `Three Y`.
- Deniz seviyesi `Y=0` kabul edilir. Kara yüksekliği kaynak yükseklik sınıfından
  türetilir; görsel abartı tek sürümlü katsayıdır.
- Şehir, tesis, yol, liman ve araç yüksekliği kendi hücre/segment yüzeyinden
  örneklenir. Model havada veya arazinin içinde kalamaz.
- Gemi yalnız seyredilebilir su segmentinde ve su düzleminde görünür.
- Yol/ray uçları aynı segment merkezlerinden üretildiği için altıgen sınırında
  kopmaz.

## 6. Kamera ve oyuncu kontrolü

İlk kamera perspektif yerine stratejik okunabilirliği koruyan eğimli
`OrthographicCamera` olacaktır. Bu sayede dünya ölçeği ve UI hit alanları
öngörülebilir kalır. Karar prototipi geçerse sınırlı perspektif kamera ayrıca
karşılaştırılır.

- pan: mevcut sol-tuş sürükleme davranışı;
- zoom: fare tekerleği, imleç altındaki dünya noktasını korur;
- dönüş: ilk prototipte kapalı veya 90° adımlı; serbest dönüş seçim/etiket
  sorunları çözüldükten sonra değerlendirilir;
- tilt: belirlenmiş min/max aralıkta;
- yakın/orta/uzak semantik LOD bantları mevcut haritayla aynı anlamı taşır;
- kamera değişimi simülasyon tikini veya rota sonucunu etkileyemez.

## 7. 3D dünya katmanları

### 7.1 Altıgen arazi

`10.584` hücre ayrı `Mesh` olmayacaktır. Aynı geometri/materyal ailesi
`InstancedMesh` veya bölgesel birleştirilmiş chunk ile çizilir.

- İlk chunk hedefi ölçümle seçilecek, başlangıç adayı `16×16` veya `24×24` hücre.
- Su, kıyı, ova, kuru arazi, orman ve dağ mekanik sınıfa göre ayrılır.
- Politik renk arazi dokusuna gömülmez; açılıp kapanabilir ayrı instance rengi
  veya düşük maliyetli overlay'dir.
- Yakın LOD hacimli arazi/bitki, orta LOD azaltılmış geometri, uzak LOD sade
  yüzey kullanır.
- Kıyı çizgisi 2D rasterdan kopyalanmaz; kanonik kara/su komşuluğundan üretilir.

### 7.2 Orman, dağ ve kaynaklar

- Orman tek tek binlerce benzersiz ağaç nesnesi değildir; tür/iklim başına
  instanced kümelerdir.
- Dağ yüksekliği hücrenin mekanik geçilebilirlik sınıfıyla uyuşur.
- Maden, tarla, fabrika veya enerji tesisi yalnız gerçek `LandUseCellV1` /
  `PhysicalSiteV1` kaydı varsa gösterilir.
- Orman kesimi, inşaat, yangın ve savaş hasarı instance görünümünü kanonik
  durum değişince günceller.

### 7.3 Şehir ve tesisler

Şehir tek model değildir. Hücre içindeki gerçek kullanım kayıtlarından modüler
parçalarla kurulur:

- merkez/çekirdek;
- konut;
- ticaret ve kamusal yapılar;
- sanayi ve lojistik;
- liman, istasyon, enerji, savunma ve çıkarım tesisleri.

Nüfus veya teknoloji artışı modeli ölçekleyerek taklit edilmez. Yeni mekanik
şehir hücresi veya kurulu teknoloji kaydı yeni modül/variant seçer.

### 7.4 Yol, ray ve liman

- Ağ yalnız kanonik fiziksel segmentlerden kurulur.
- Yol/ray, her kare yeniden yaratılmaz; topoloji/hasar revizyonunda ilgili chunk
  güncellenir.
- Uzak LOD çizgi/şerit, yakın LOD hacimli yol yatağı, ray, travers ve istasyon
  kullanır.
- Kırık/kapalı segment görsel hasar alır fakat gerçek geçiş durumu simülasyondan
  okunur.
- Liman kara ve su terminal hücresini birlikte kullanır; denizde yüzen şehir
  veya karada gemi üretilemez.

### 7.5 Hareketli araçlar

Araç modelleri GLB/glTF olacak; 2D sprite plane kullanılmayacaktır.

- `ROAD_CONVOY`: çekici/kamyon ailesi, dönüş ve tekerlek animasyonu.
- `FREIGHT_TRAIN`: lokomotif + vagon instance zinciri; vagon sayısı yük/LOD
  politikasına göre görseldir, kargo miktarını değiştirmez.
- `CARGO_SHIP`: konteyner gemisi; yön, yalpa, pervane izi ve su izi görseldir.
- `WAITING/QUEUED`: fiziksel konum korunur, durum işareti UI/ışık diliyle görünür.
- Uzak LOD aynı shipment kayıtlarını kümeler; hayalî dekoratif trafik üretmez.

## 8. Seçim, UI ve etiketler

Three.js raycast sonucu `instanceId` üzerinden kanonik kimliğe çevrilir:

```text
instanceId → renderIdentity → mapEntity → storySelectNode / StoryUI
```

Mevcut sağ `BÖLGE` paneli korunur. Şehir, ilçe, fabrika, liman, yol, tren veya
gemi seçildiğinde bugün kullanılan `mapEntity` biçimi genişletilerek aynı UI
girişine verilir. Renderer doğrudan HTML üretmez.

İlk dikeyde şehir/önemli tesis etiketleri HTML overlay veya tek GPU yazı atlası
olarak kalabilir. Binlerce DOM etiketi yasaktır. Etiketler çakışma, uzaklık ve
önem politikasına göre seçilir.

## 9. Varlık üretim hattı

### 9.1 Kaynak biçimi

- Model: GLB/glTF 2.0.
- Materyal: PBR; renk, normal, roughness/metalness ve gerektiğinde emissive.
- Doku: geliştirmede PNG/TGA kaynak; üretimde mipmap'li KTX2/Basis sıkıştırma.
- Geometri: kontrollü LOD0/LOD1/LOD2; gerekirse Meshopt/Draco sıkıştırma.
- Animasyon: yalnız gerekli kemik/klipler; araç hareketi çoğunlukla transform.

### 9.2 Katalog kimliği

Her model şu eksenlerle sürümlü manifest kaydı alır:

`era × region × function × technologyTier × physicalState × lod`

Modelin seçilme nedeni simülasyonda yoksa katalog girdisi üretilemez. 2010–2100
için binlerce dosya aynı anda yüklenmez; yalnız görünen bölge, çağ ve komşu LOD
paketleri bellekte bulunur.

### 9.3 İlk model paketi

Karar prototipi için asgarî fakat gerçek paket:

- 6 arazi materyali, 3 ağaç ve 3 dağ ailesi;
- Ankara/İstanbul için 2 şehir çekirdeği ve 6 modüler ilçe ailesi;
- yol, ray, köprü, istasyon ve liman seti;
- 1 modern tır, 1 lokomotif + 2 vagon, 1 konteyner gemisi;
- çalışan, bekleyen ve hasarlı görsel durumlar;
- seçim, sahiplik ve rota vurgusu.

Bu paket geçmeden yüzlerce model üretilmez.

## 10. Bellek ve performans bütçesi

Hedef makine RTX 4060 8 GB VRAM ve 16 GB sistem RAM kabul edilerek LLM ile
birlikte güvenli tavanlar konur.

| Ölçü | Karar prototipi hedefi | Ret sınırı |
|---|---:|---:|
| 1080p normal p95 kare | `≤16,7 ms` | `>22 ms` |
| 8B LLM açık p95 kare | `≤25 ms` | `>33,4 ms` |
| Yakın LOD draw call | `≤250` | `>400` |
| Yakın LOD görünür üçgen | `≤1,5 M` | `>2,5 M` |
| 3D harita ek VRAM | `≤700 MiB` | `>1.000 MiB` |
| 3D harita ek RAM | `≤900 MiB` | `>1.300 MiB` |
| İlk oynanabilir kare | `≤1,5 sn` | `>3 sn` |
| Kamera sırasında sonradan beliren şehir | `0` | `>0` |
| 10 dk sonrası sürekli bellek büyümesi | `<%5` | `≥%10` |

Makine doluyken alınan FPS değeri kabul sonucu sayılmaz. İşlevsel doğrulama
ayrı, sakin-makine performans kapısı ayrı raporlanır.

## 11. Bellek yaşam döngüsü

- 3D açılışında büyük 2D dünya canvas/bitmap katmanları serbest bırakılır.
- 2D geri dönüş ilk prototipte sıcak anahtar değil, güvenli yeniden yükleme ile
  yapılır; iki harita bellekte birlikte tutulmaz.
- Geometri, materyal ve doku referans sayacıyla paylaşılır.
- Bölge/LOD paketi görünümden çıktığında gecikmeli tahliye edilir; kamera küçük
  hareketinde sürekli yükle-boşalt yapılmaz.
- `renderer.info` ve uygulama sicili geometri, doku, draw-call ve üçgen sayısını
  kaydeder.
- WebGL context kaybında simülasyon yaşamaya devam eder; renderer açıklamalı
  biçimde yeniden kurulur veya 2D'ye düşer.

## 12. Uygulama fazları

### HXD-9C.0 — Sözleşme dondurma ve ölçüm tabanı

- 2D aynı kayıt için kimlik, kamera, seçim ve frame telemetrisi çıkar.
- `Story3DProjectionSnapshotV1` şeması tanımlanır.
- Renderer'ın yazabileceği alan olmadığı testle doğrulanır.

**Çıkış:** 2D/3D karşılaştırmasının referans JSON'u.

### HXD-9C.1 — WebGL kabuğu ve güvenli geri dönüş

- Three.js kesin sürüm, yerel paketleme ve lisans kaydı.
- Ayrı `--story-renderer=3d` başlangıç bayrağı.
- WebGL2 yetenek kontrolü, context loss ve 2D fallback.
- Boş sahne, kamera, resize, render telemetrisi.

**Çıkış:** Simülasyonu değiştirmeyen çalışan 3D canvas.

### HXD-9C.2 — Kanonik altıgen arazi

- Marmara–Ankara görünür hücreleri, yükseklik, kara/su/kıyı ve politik overlay.
- Chunk/instance karşılaştırması ve üç LOD.
- Kamera sınırı, pan, zoom ve imleç-ankorlu yakınlaşma.

**Çıkış:** Hücre kimliği ve kıyı doğruluğu korunan 3D dünya.

### HXD-9C.3 — Seçim ve mevcut UI köprüsü

- Raycaster/instance kimlik tablosu.
- Şehir, hücre, tesis ve segment seçimi.
- Sağ Bölge paneli ve mevcut eylemlerle eşlik.

**Çıkış:** 2D ve 3D aynı tıklamada aynı `mapEntity` sonucunu verir.

### HXD-9C.4 — Şehir, tesis ve ulaşım ağı

- Ankara/İstanbul modüler şehirleri.
- Gerçek yol, ray, istasyon ve liman segmentleri.
- İnşaat/hasar/kapalı durum projeksiyonu.

**Çıkış:** Resim plane'i olmadan mekanik dünya kayıtları gözlenir.

### HXD-9C.5 — Gerçek 3D taşıma ajanları

- Tır, lokomotif/vagon ve konteyner gemisi GLB modelleri.
- Segment konumu, yön, bekleme ve terminal kuyruğu.
- LOD kümelenmesi ve sevkiyat sayısı/yük korunumu.

**Çıkış:** 2D hareketli resimler yerine gerçek 3D araçlar; mekanik sonuç aynı.

### HXD-9C.6 — Işık, materyal, hava ve hasar

- Gündüz/gece ışığı, gölge bütçesi, su ve atmosfer.
- Fırtına/abluka görünümü yalnız gerçek deniz koşulu defterinden.
- Hasarlı yol/tesis/araç durumu kanonik fiziksel kayıttan.

**Çıkış:** Atmosfer simülasyon gerçeğini süsler, değiştirmez.

### HXD-9C.7 — Eşlik, performans ve uzun koşu

- Aynı save üzerinde 2D/3D kimlik ve seçim karşılaştırması.
- Normal, LLM açık, yoğun sevkiyat ve kamera stres koşuları.
- 10 dakika VRAM/RAM, context loss ve kayıt-yükleme.
- Görsel uzak/orta/yakın QA kareleri.

**Çıkış:** Karar raporu.

### HXD-9C.8 — GO / CONDITIONAL GO / NO-GO kararı

`GO`: Bütün kritik kapılar geçer; HXD-13 ve sonraki görsel üretim 3D kataloğa
göre ilerler.  
`CONDITIONAL GO`: Kimlik ve oynanış doğru, performans borçlu; yalnız sınırlı
bölge üretimi ve optimizasyon devam eder.  
`NO-GO`: Kayıt/kimlik eşliği bozulur, bellek sınırı aşılır veya 2D'den düşük
oynanabilirlik oluşur; 2.5D korunur, prototip ürün varsayılanına girmez.

## 13. Zorunlu test matrisi

### Mekanik eşlik

- Aynı seed ve komutlar 2D/3D'de aynı dünya karmasını üretir.
- Renderer açık/kapalıyken stok, rota, teslim süresi ve AI kararı aynıdır.
- Kamera hareketi dünya tikini veya shipment ilerlemesini değiştirmez.
- Araç modeli hedefe varmadan hedef stok artmaz.

### Mekânsal doğruluk

- Şehir denizde: `0`.
- Gemi karada: `0`.
- Tren ray dışı: `0`.
- Tır fiziksel yol/terminal dışı: `0` (bekleme cebi tanımları hariç).
- Yol/ray uç kopukluğu: `0`.
- 2D/3D seçilen kanonik kimlik farkı: `0`.

### Görsel/UX

- Kamera hareketinde sonradan beliren şehir: `0`.
- Etiket titremesi ve LOD ileri-geri salınımı: `0`.
- Seçili nesne, hasar, abluka ve terminal kuyruğu okunur.
- Uzak görünüm stratejik okunabilirliği, yakın görünüm model ayrıntısını korur.

### Teknik

- Shader ilk kullanım takılması kabul sınırını geçmez.
- WebGL context kaybı kayıt bozmaz.
- GLB/doku eksikliğinde açık fallback ve teşhis vardır.
- Paketlenmiş EXE çevrim dışı bütün prototip kaynaklarını açar.
- Test/oyuncu EXE aynı renderer kodunu kullanır.

## 14. 3D kabulünden sonraki üretim sırası

1. Modern Marmara/Ankara nihai kalite paketi.
2. Türkiye, Balkanlar ve Doğu Akdeniz bölgesel paketleri.
3. Avrupa/N. Afrika görünür dünya kapsamı.
4. 2010–2100 teknoloji dönemleri ve eski/yeni filonun birlikte görünmesi.
5. İnşaat, hasar, yangın, enkaz ve çevresel dönüşüm durumları.
6. Karakterlerin fiziksel seyahat modelleri ve toplantı varışları.
7. Stratejik savaş hasarının aynı altıgen dünyada görünmesi.
8. Ayrı kapsam olarak 3D taktik savaş alanı ve birlik modelleri.

Hikâye haritasının 3D kabulü, taktik savaş motorunun otomatik olarak 3D'ye
geçtiği anlamına gelmez. İki renderer aynı varlık üretim hattını paylaşabilir
fakat ayrı performans ve oynanış kapılarından geçmelidir.

## 15. İlk uygulanacak iş

Önce `HXD-9C.0` yapılacaktır: kanonik snapshot, renderer-yazmazlık testi,
2D referans kimlik/performans raporu ve `--story-renderer` yaşam döngüsü
sözleşmesi. Three.js veya model dosyası ancak bu sınır sabitlendikten sonra
projeye eklenir. Böylece ilk 3D kare uğruna simülasyon temeli tekrar bozulmaz.
