MODE: AUDIT

### 1) Optimization Summary

Gerçek Electron `--maptest` koşusunda sabit durum çizimi hedefi karşılıyor: uzak/orta/yakın yakınlaştırmada p95 sırasıyla 15,4/13,1/16,3 ms, etkileşim p95'i 13,7 ms ve taşıt overlay p95'i 0,4 ms. Sağlık sorunu sürekli kare çiziminden çok açılış üretimi ve kalıcı raster belleğinde: ölçülen katman toplamı 1.194,1 MiB; bunun 986,3 MiB'ı iki şehir/ilçe katmanı. Doğal yüzey ayrıca raporun saymadığı ikinci bir tam çözünürlüklü kopyayı tutuyor ve 4 ms bütçeli bir dilim 109,6 ms sürdü. En yüksek etkili üç iyileştirme: doğal yüzeyin kaynak canvas kopyasını promosyon sonrası bırakmak, 8x ilçe rasterini görünür karo/LOD temelli üretmek ve doğal yüzey işini gerçek süre bütçesine uyan küçük dilimlere bölmek. Değişiklik yapılmazsa düşük bellekli makinelerde açılış baskısı ve olası süreç sonlandırması, bütün makinelerde ise ilk dünya yüklemesinde hissedilir takılma devam eder; mevcut maptest'teki üç eskimiş ölçüm de gerçek regresyonları gürültüye gömer.

### 2) Findings (Prioritized)

#### Doğal yüzey promosyonu kaynak canvas'ı ve karo kopyasını birlikte tutuyor

- **Category:** Memory
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** `js/StoryMapRendererV2.js:1019`, `promoteHexNaturalContentsToRamTiles` (`js/StoryMapRendererV2.js:1068`)
- **Evidence:** Tam yüzey `STORY._hexNaturalContentsCanvas = job.canvas` ile tutuluyor; promosyon aynı alanı 1024 px canvas karolarına tekrar kopyalıyor. `cache.byteLength` kaynak canvas (114.600.000 bayt) ile overview'u sayıyor fakat karo kopyalarını saymıyor. Ölçülen `naturalBytes=120.360.000` bu nedenle son durumdaki yaklaşık 114.600.000 baytlık ikinci kopyayı dışarıda bırakıyor.
- **Why it matters:** Raporlanan 1.194,1 MiB toplamın üzerinde en az yaklaşık 109,3 MiB canvas belleği daha kalıyor; tarayıcı/GPU muhasebe ek yükleri buna dahil değil.
- **Recommended fix:** Karolar ve overview eşzamanlı hazırlandıktan sonra kaynak canvas'ı 1×1'e küçült; `byteLength` değerini kalan karo + overview yüzeylerinden hesapla. Geçiş sırasında önceki tamamlanmış RAM karolarını koruyan mevcut davranışı değiştirme.
- **Tradeoffs / Risks:** RAM karolarının oluşturulamadığı platformda kaynak canvas fallback'i kaybolabilir; serbest bırakma yalnız tüm karolar doğrulandıktan sonra yapılmalı.
- **Expected impact:** Kalıcı yüzey belleğinde yaklaşık 109,3 MiB azalma; dayanak mevcut canvas ölçüleridir.
- **Effort:** S
- **Scope:** `js/StoryMapRendererV2.js`

#### 8x ilçe rasteri tek başına yaklaşık 986 MiB tutuyor

- **Category:** Memory
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** `storyBuildSparseSettlementWorldLayer` (`js/StoryRender.js:1121`), `storySettlementWorldLayersEnsure` (`js/StoryRender.js:1211`), `js/StoryMapRendererV2.js:31`
- **Evidence:** Gerçek Electron ölçümü `cityBytes=1.034.257.408` (986,3 MiB) ve `districtRasterScale=8` verdi. Katman üreticisi CORE 2x ve DISTRICTS 8x karolarını birlikte kalıcı tutuyor; alan maliyeti ölçeğin karesiyle büyüyor.
- **Why it matters:** Tek görsel alt sistem tipik 1 GiB sınırına yaklaşıyor. Düşük bellekli/GPU paylaşımlı makinelerde açılış süresini, bellek basıncını ve renderer süreç sonlandırma riskini büyütüyor.
- **Recommended fix:** DISTRICTS katmanını bütün şehirler için kalıcı 8x üretmek yerine görünür dünya karoları için talep üzerine üretip sınırlı LRU ile tut. İlk güvenli basamak olarak 8x ve 4x A/B görsel kabul testi yap; yakın zoomda seçili şehir için yüksek çözünürlüklü doğrudan çizim fallback'i kullan.
- **Tradeoffs / Risks:** Raster ölçeğini doğrudan düşürmek yakın zoom keskinliğini azaltabilir; LRU yaklaşımı kamera hareketinde yeni üretim takılması yaratmamalı. Görsel kabul ve cache-hit ölçümü zorunlu.
- **Expected impact:** 8x→4x alan maliyeti teorik olarak %75 azalır; gerçek kazanç seyrek karo kapsamı ve LRU çalışma setiyle ölçülmelidir, ancak yüzlerce MiB mertebesindedir.
- **Effort:** M
- **Scope:** `js/StoryRender.js`, harita raster yapılandırması

#### 4 ms doğal-yüzey dilimi 109,6 ms ana iş parçacığı işi üretiyor

- **Category:** Frontend
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** `processHexNaturalContents` (`js/StoryMapRendererV2.js:1170`), `paintHexNaturalCell` (`js/StoryMapRendererV2.js:829`)
- **Evidence:** Gerçek Electron koşusunda `frameBudgetMs=4` iken `maxSliceMs=109.6`; ilk dilim 768 hücre tavanına ve süreyi ancak en az 24 hücreden sonra denetleyen koşula bağlı. Her hücre clip, atlas seçimi ve en az bir atlas çizimi yapıyor.
- **Why it matters:** 16,7 ms 60 FPS bütçesinin yaklaşık 6,6 katı tek uzun görev açılışta görünür takılma oluşturur. Gizli test penceresindeki toplam 19 saniye rAF kısılmasından etkilenebilir; 109,6 ms dilim süresi bundan bağımsız ana-thread kanıtıdır.
- **Recommended fix:** İlk kontrol eşiğini 24'ten 4–8 hücreye, sert tavanı 768'den ölçümle belirlenecek küçük bir değere indir; atlas/placement kararlarını hücre döngüsü dışında ön-hesapla. Son maske kompozisyonunu da ayrı ölç ve gerekiyorsa dilimle.
- **Tradeoffs / Risks:** Daha çok rAF turu yüzeyin tam hazır olma süresini uzatabilir; kısmi canvas davranışı korunmalı ve toplam süre ile en uzun dilim birlikte optimize edilmeli.
- **Expected impact:** Hedef max dilim ≤16,7 ms ve p95 ≤8 ms; mevcut en kötü dilime göre en az %85 azalma hedefi.
- **Effort:** M
- **Scope:** `js/StoryMapRendererV2.js`

#### Maptest artık üretilmeyen siyasi sınır RAM katmanını zorunlu sayıyor

- **Category:** Reliability
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `electron/main.js:629`; `_politicalBorderWorldLayer` kullanımları `js/StoryMapCache.js:81-103,201`
- **Evidence:** Test `borderBuilds !== 1` durumunu “beklenmedik yeniden üretim” diye başarısız saydı. Depo taramasında `_politicalBorderWorldLayer` için üretici/yazıcı yok; yalnız temizleme, durum raporu ve test okuması var. Gerçek sonuç `borderBuilds=0`, network/coast build değerleri 1.
- **Why it matters:** Performans kapısı her koşuda yanlış başarısız olur; yeni gerçek regresyonlar sürekli kırmızı rapor içinde seçilemez.
- **Recommended fix:** Eski katman sayacını kaldırıp aktif politik hex overlay'in build/invalidation tanısını sınayın; hata metnini de “yeniden üretim” ile “eksik katman”ı ayıracak şekilde düzeltin.
- **Tradeoffs / Risks:** Aktif overlay için eşdeğer bir sayaç yoksa önce salt-okunur tanı alanı eklemek gerekir.
- **Expected impact:** Bir deterministik yanlış alarm kaldırılır; maptest yeniden güvenilir kapı olabilir.
- **Effort:** S
- **Scope:** `electron/main.js`, politik overlay tanısı

#### Taşıt performans testi hiç doldurulmayan örnek dizisini okuyor

- **Category:** Reliability
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `electron/main.js:673-730`, `storyDrawTransportAgents` (`js/StoryRender.js:2515-2707`)
- **Evidence:** Renderer `presentationSamples` dizisini her karede sıfırlayıp tanıya bağlıyor (`js/StoryRender.js:2537`) fakat depoda bu diziye `push` veya indeks yazımı yok. Test bu nedenle hareketli shipment mevcut ve overlay p95 0,4 ms olsa da `sampleCount=0` ile başarısız oldu.
- **Why it matters:** Taşıt akıcılığı regresyon testi çalışmıyor; aynı zamanda önceki “taşıt çizimi akıcı” sonucunu hareket örnekleriyle doğrulayamıyor.
- **Recommended fix:** Ekranda çizilen sınırlı sayıda ajanın mevcut ve hedef koordinatlarını tanıya yazın ya da testte doğrudan `snapshot.displayAgents` konumlarını örnekleyin. Üretim render yolunda sınırsız tanı tahsisi oluşturmayın.
- **Tradeoffs / Risks:** Her ajan için her kare nesne üretmek GC yükü doğurur; sabit kapasiteli sayısal örnek tamponu veya QA bayrağı kullanılmalı.
- **Expected impact:** Taşıt hareket kapısının doğruluğu geri gelir; üretim performansına etkisi QA-dışı yolda sıfır olmalı.
- **Effort:** S
- **Scope:** `electron/main.js`, `js/StoryRender.js`

#### Hover testi rAF işleyicisini beklemeden 24 kez sonuç okuyor

- **Category:** Reliability
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `electron/main.js:743-777`, `js/StoryUI.js:2359-2397`
- **Evidence:** `mousemove` yalnız `requestAnimationFrame(processHover)` planlıyor. Maptest aynı senkron döngü içinde event'i gönderip hemen `_hoverHexCellId` okuduğu için rAF çalışamıyor; sonuç `regionEntityMisses=0`, `cellMisses=24`.
- **Why it matters:** Gerçek hit-test doğru olduğu halde HOVER_AND_SELECTION akışı kırmızı görünür ve performans/etkileşim kabulü güvenilmezleşir.
- **Recommended fix:** Her event'ten sonra bir rAF/paint turu bekleyin veya testin doğrudan çağırabileceği salt hesaplama fonksiyonunu işleyiciden ayırın.
- **Tradeoffs / Risks:** 24 gerçek rAF testi süreyi artırır; saf fonksiyon çıkarımı davranış eşdeğerliğini ayrıca sınamalı.
- **Expected impact:** İki yanlış alarm (`cellMisses`, `HOVER_AND_SELECTION`) kalkar.
- **Effort:** S
- **Scope:** `electron/main.js`, isteğe bağlı `js/StoryUI.js`

#### Görsel durum anahtarı her 500 ms'de düğüm dizisini stringleştiriyor

- **Category:** Memory
- **Severity:** Medium
- **Confidence:** Likely
- **Location:** `storyWorldVisualStateKey` (`js/StoryRender.js:64`)
- **Evidence:** Fonksiyon tüm düğümleri iki ardışık `map/join` ile bileşik stringe dönüştürüyor; çağrı yolu panel periyodunda görsel invalidation kontrolü yapıyor. Ancak mevcut Electron koşusunda bu fonksiyona özel allocation/GC ölçümü alınmadı.
- **Why it matters:** 152 düğümlü uzun oturumda düzenli kısa ömürlü string üretimi GC baskısı yaratabilir; önceki raporun “%50–80” iddiasını destekleyen ölçüm bulunmadı.
- **Recommended fix:** Önce Chrome allocation profiler ile fonksiyonun saniyelik bayt ve GC payını ölçün. Maddiyse sahiplik/seviye/tesis mutasyonlarının artırdığı tek bir görsel revision sözleşmesine geçin.
- **Tradeoffs / Risks:** Eksik revision artırımı haritanın bayat kalmasına yol açar; bütün mutasyon üreticileri envanterlenmeden değiştirilmemeli.
- **Expected impact:** Doğrulama eşiği: bu fonksiyon görsel dünya yolundaki allocation'ın ≥%10'unu oluşturuyorsa revision geçişi; altında ise değişiklik yapılmamalı.
- **Effort:** M
- **Scope:** `js/StoryRender.js` ve görsel dünya mutasyon üreticileri

Maddi bulgu saptanmayan kategoriler: I/O, Network, DB, Algorithm, Concurrency, Build, Caching, Cost, Reuse ve Dead Code. İnceleme kapsamı Electron dünya haritası açılışı/render/etkileşim yoludur; bu ifade repo genelinde bu kategorilerin kusursuz olduğu anlamına gelmez.

### 3) Quick Wins

1. Doğal yüzey karoları hazır olduktan sonra kaynak canvas'ı serbest bırakıp gerçek kalan baytları raporlayın; yaklaşık 109,3 MiB kalıcı kazanım.
2. Maptest'ten ölü `borderBuilds === 1` varsayımını kaldırıp aktif politik overlay tanısına bağlayın.
3. Hover testinde event sonrası rAF bekleyin; 24/24 yapay hücre kaçırmasını düzeltin.
4. Taşıt örneklemesini sabit kapasiteli QA tamponuyla geri getirin; üretim yoluna yeni per-frame nesne tahsisi eklemeyin.

### 4) Deeper Optimizations

- **Görünür-karo ilçe rasteri + sınırlı LRU:** Kalıcı şehir katmanı 512 MiB üzerinde kaldığı veya 8 GiB RAM'li hedef makinede renderer working set 1,5 GiB'ı geçtiği anda zorunlu. Seçili/yakın şehir için yüksek çözünürlük, görünmeyen şehirler için üretimsiz durum hedeflenmeli.
- **OffscreenCanvas/worker doğal-yüzey üretimi:** Küçültülmüş hücre dilimleriyle max süre yine 16,7 ms'yi aşıyorsa gerekli. Ana thread yalnız tamamlanan karoları devralmalı; deterministik atlas seçimi ve save/load görsel hash'i korunmalı.
- **Revision tabanlı görsel invalidation:** Allocation profili `storyWorldVisualStateKey` kaynaklı tahsisi görsel yolun en az %10'u olarak gösterirse uygulanmalı. Bütün mutasyon noktaları kapsanmadan başlanmamalı.

### 5) Validation Plan

- **Benchmarks:** İzole kullanıcı profiliyle üç soğuk ve üç sıcak `electron . --maptest` koşusu; 8 GiB ve 16+ GiB hedef sınıflarında menu→world açılışı. Aynı seed, pencere boyutu ve zoom örnekleri kullanılmalı.
- **Profiling strategy:** Chrome DevTools Performance + Memory/Allocation instrumentation; doğal yüzey başlangıcı, `storySettlementWorldLayersEnsure`, ilk yakın zoom ve 60 saniyelik pan/hover/taşıt akışı ayrı işaretlenmeli. Chromium Task Manager ile renderer private memory de kaydedilmeli.
- **Before/after metrics:** Kalıcı raporlanan harita katmanları <512 MiB; renderer private working set hedef makinede <1 GiB; doğal yüzey max dilim ≤16,7 ms ve p95 ≤8 ms; sabit render yakın zoom p95 ≤16,7 ms; hiçbir maptest yanlış alarmı yok.
- **Correctness tests:** Mevcut hex doğal kaynak/tarım/site/inşaat/görsel katalog/map-renderer testleri, 9 çözünürlük/zoom örneği, siyasi sahiplik değişimi, mevsim görünümü, taşıt konum sürekliliği ve hover/seçim eşleşmesi aynı şekilde geçmeli.
- **Karar ölçümü:** 8x→4x ve görünür-karo prototipleri aynı yakın zoom ekranlarında piksel farkı + insan görsel kabulüyle karşılaştırılmalı; kalite kaybı kabul edilmeden bellek kazancı uygulanmamalı.

### 6) Proposed Patches

#### Patch 1 — Kaynak doğal-yüzey canvas'ını promosyon sonrası bırak

Davranış riski: RAM karo fallback sırası değişebileceği için doğrulama gerekir.

```javascript
// promoteHexNaturalContentsToRamTiles içinde
let retainedTileBytes = 0;
// Her tile oluşturulduğunda:
retainedTileBytes += width * height * 4;

// Bütün karolar hazırlandıktan sonra:
cache.byteLength = retainedTileBytes
    + overview.width * overview.height * 4;
releaseHexNaturalRamTiles('replacement');
STORY._hexNaturalContentsRamTiles = cache;
canvas.width = 1;
canvas.height = 1;
```

Değişiklik, aynı tam çözünürlüklü içeriğin kaynak canvas ve karo canvas'larında iki kez kalmasını önler; eski tamamlanmış cache yalnız yeni cache hazır olduğunda bırakılır.

#### Patch 2 — Doğal-yüzey diliminde erken süre denetimi

Davranış riski: Tam yüzeyin hazır olma süresi uzayabilir; kısmi çizim sözleşmesi korunur.

```javascript
const maxCellsPerSlice = 64;
while (job.cursor < job.order.length) {
    paintHexNaturalCell(job, job.order[job.cursor++]);
    painted++;
    if (painted >= maxCellsPerSlice) break;
    if (painted >= 4
        && hexNaturalNow() - sliceStarted >= job.frameBudgetMs) break;
}
```

Değişiklik 24–768 hücrelik kör pencereyi 4–64'e indirir. Sabitler varsayım olarak bırakılmamalı; Validation Plan'daki üç soğuk koşuyla ayarlanmalıdır.

#### Patch 3 — Hover kabulünde asenkron işleyiciyi bekle

Yalnız QA davranışını değiştirir.

```javascript
cv.dispatchEvent(new MouseEvent('mousemove', eventInit));
await new Promise(resolve => requestAnimationFrame(() => resolve()));
if (expectedCell && String(STORY._hoverHexCellId) !== String(expectedCell.id)) {
    cellMisses++;
}
```

Test gövdesi bu değişiklik için `async` kalmalıdır. Böylece ölçüm üretim kodundaki rAF sözleşmesiyle aynı zaman sınırında yapılır.
