# 1) Verdict

- **Root cause:** Çok modlu lojistik katmanı, her 4 oyun saniyesinde ana renderer iş parçacığında binlerce kaynak-hedef çifti için rotayı sıfırdan hesaplıyor; bu senkron rota fırtınası 0,8–3,8 saniyelik dünya adımları üreterek tüm oyunu donduruyor.
- **Confidence:** Confirmed.
- **Zincir:** 4 saniyelik ekonomi tetiği → hane/Pareto/üretim dağıtıcıları → binlerce tekrarlı rota araması → renderer event loop'unun bloklanması → görüntü, girdi ve taşıt hareketinin saniyelerce durması.
- **Durum:** Ongoing. Sorun mevcut çalışma ağacında yeniden üretildi; bu inceleme yalnız teşhis yaptı, kaynak kodu değiştirmedi.

# 2) Failure Definition

- **Title:** Dört saniyelik lojistik tetiği renderer'ı saniyelerce bloke ediyor
- **Category:** Performance / synchronous main-thread work
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** `js/Story.js:1652-1664`, `js/StoryTrade.js:2939-3115`, `js/StoryTrade.js:3176-3258`, `js/StoryInfrastructure.js:766-839`
- **Precise symptom:** Bildirilen “oyun saniyeler derecesinde donuyor” davranışı bir çizim karesi sorunu değil. Dünya zamanı açıkken özellikle 4'ün katlarında tek bir `storyAdvanceStep` çağrısı yüzlerce milisaniye ile birkaç saniye arasında sürüyor. Bu sırada renderer aynı iş parçacığında olduğu için ekran, fare/klavye ve taşıt animasyonu birlikte duruyor.
- **Reproduction:** Mevcut `tools/story-sim-harness.js` ile seed 2032, 0,25 saniyelik sabit adım ve 60 oyun saniyesi çalıştırıldı. Başarı oranı 2/2; her kontrollü koşuda 4 saniyelik periyotlarda uzun adımlar oluştu.
  - 60 saniye: 240 adım, ortalama 142,079 ms, p95 1.374,413 ms, p99 2.696,650 ms, maksimum 3.844,119 ms; 24 adım 33 ms üstünde.
  - 25 saniyelik zaman korelasyonu: 4 s = 785 ms, 8 s = 1.086 ms, 12 s = 1.450 ms, 20 s = 3.650 ms, 24 s = 2.926 ms. 16. saniyedeki 350 saniyelik makine-yükü aykırı değeri nedensellik hesabına dahil edilmedi.
- **Blast radius:** Hikâye modunda dünya zamanı akan tüm yeni kampanyalar. Hız yükseltmek sorunu daha sık görünür kılar. Sohbette/duraklatmada `storyAdvanceStep` erken döndüğü için belirti kaybolur (`js/Story.js:1550-1552`). Hızlı savaş motoru bu zinciri kullanmıyor.
- **First occurrence:** Kullanıcı açısından kesin ilk görülme zamanı bilinmiyor. Mekanizmayı oluşturan fiziksel çok modlu rota entegrasyonu git geçmişinde `6ece5a54` (2026-08-20, “hikaye dunyasina fiziksel cok modlu lojistik ekle”) ile geldi; eski hane dağıtım algoritması bu committe fiziksel rota planlayıcıya bağlandı.
- **Evidence:** Aynı başsız çalışma renderer, harita sprite'ları ve LLM olmadan donmayı yeniden üretti. Dolayısıyla harita çizimi veya model RAM'i gerekli koşul değildir.
- **Why it matters:** Gerçek oyunda saniyelik cevap vermeme, kullanıcının uygulamayı çökmüş sanmasına ve oynanışın fiilen durmasına yol açıyor.
- **Recommended fix:** Bölüm 6'daki kalıcı düzeltme uygulanana kadar lojistik kabul katmanını sınırlı/bütçeli çalıştır; ardından aday eşleştirme ve rota çözümünü önceden hesaplanmış ülke/mode erişilebilirlik matrisi ile yeniden kur.
- **Tradeoffs / Risks:** Lojistiği tamamen kapatmak ekonomik doğruluğu ve fiziksel taşıt üretimini geçici olarak azaltır; kalıcı düzeltmede deterministik seçim ve kapasite rezervasyonu korunmalıdır.

# 3) Timeline

| Time | Event | Source | Significance |
|---|---|---|---|
| 2026-08-03 | Dört pencerelik hane dağıtım kabulü eklendi. | Commit `52641eb8`, `js/StoryTrade.js:2932-3115` | Her talep için aynı ülkedeki bütün arzları rota aramasıyla tarayan all-pairs yapı doğdu; o sırada rota grafiği daha ucuzdu. |
| 2026-08-20 20:56 +03 | Fiziksel çok modlu rota planlayıcı ve taşıt ajanları eklendi. | Commit `6ece5a54` | Her başarılı dispatch artık fiziksel plan/rezervasyon yapıyor; `storyTradeFindRoute` önbelleği açıkça kapatıyor (`js/StoryTrade.js:737-756`). |
| 2026-08-22 | Kullanıcı oyunun saniyelerce donduğunu bildirdi. | Operator report | İlk doğrulanmış kullanıcı belirtisi. Kesin ilk görülme tarihi bilinmiyor. |
| 2026-08-22 | Harita/taşıt çizimi ölçüldü. | Canlı `--maptest` ölçümleri | Taşıt overlay p95 yaklaşık 0,2 ms; kamera/render 15–19 ms. Görsel katman hipotezini refute etti. |
| 2026-08-22 | Başsız 60 saniyelik dünya koşusu yapıldı. | `runStorySimulation`, seed 2032 | Renderer ve LLM olmadan maksimum 3.844 ms dünya adımı; simülasyon zincirini doğruladı. |
| 2026-08-22 | Ekonomi alt yordamları ayrı sürelendi. | Test-süreci sarmalayıcıları | 3 tikte lojistik 2.321 ms; bölgesel ekonomi 661 ms; diğer ekonomi işleri toplamda belirgin şekilde daha küçük. |
| 2026-08-22 | Lojistiğin iç rota yükü ölçüldü. | Test-süreci sarmalayıcıları | 12 saniyede 7.565 `storyInfrastructureFindRoute`, 2.346 dispatch girişimi; hane dağıtımı tek başına 1.202 ms. |
| 2026-08-22 | Özellik bayrağı A/B testi yapıldı. | Başsız 12 saniyelik koşular | Baseline max 1.474 ms; hane dağıtımı kapalı 865 ms; hane+Pareto kapalı 551 ms; tüm ticaret lojistiği kapalı 101,7 ms. |

# 4) Hypotheses (ranked)

## 4.1 Supported — Dört saniyelik lojistik rota fırtınası

- **Hypothesis:** `storyTradeLogisticsTick`, hane ve diğer kabul geçitlerinde çok sayıda kaynak-hedef çifti için aynı grafiği tekrar kurup rota arıyor ve renderer'ı blokluyor.
- **If true, we would also see:** Uzun adımlar 4'ün katlarında kümelenir; lojistik kapatılınca saniyelik maksimum kaybolur; rota çağrı sayısı bölge/sevkiyat sayısından çok daha büyük olur.
- **Discriminating test:** 0,25 saniyelik adımları saat ile korele et; lojistik alt yordamlarını sürele; `economy.tradeLogistics` bayrağıyla A/B çalıştır.
- **Status:** Supported / Confirmed. Donmalar 4, 8, 12, 20 ve 24. saniyelerde oluştu. 12 saniyede 7.565 altyapı rota araması ve 2.346 dispatch girişi ölçüldü. Lojistik kapalı maksimum 1.474 ms'den 101,7 ms'ye düştü.

## 4.2 Supported contributor — Bölgesel ekonomi ve beş saniyelik tick kümesi

- **Hypothesis:** Lojistik dışında, bölgesel ekonomi ve sıfır-fazlı 5 saniyelik görevler de görünür takılma üretir.
- **If true, we would also see:** Lojistik kapalı olsa dahi 16,7/33 ms bütçeleri aşılır; 5'in katlarında 100 ms civarı adımlar kalır.
- **Discriminating test:** Lojistiği kapalı 12 saniyelik koşu; `storyRegionalEconomyTick` ve 5 saniyelik katmanları ayrı süreleme.
- **Status:** Supported. Lojistik kapalı maksimum 101,7 ms ve p95 56,1 ms kaldı. `storyRegionalEconomyTick` üç çağrıda toplam 660,5 ms, maksimum 222,0 ms ölçüldü. Bu ana saniyelik donmanın kökü değil, sonraki yüksek öncelikli katkıdır.

## 4.3 Refuted — Taşıt sprite'ları ve harita yeniden çizimi donuyor

- **Hypothesis:** Kamyon/tren/gemi her hareketinde pahalı çizim veya katman rebuild'i yapıyor.
- **If true, we would also see:** Yalnız overlay çizimi veya kamera etkileşimi yüzlerce/saniyelerce sürer; başsız simülasyonda belirti kaybolur.
- **Discriminating test:** Taşıt overlay'ini ayrı ölç; statik dünya rebuild sayısını izle; renderer olmadan aynı dünya adımlarını çalıştır.
- **Status:** Refuted. Taşıt overlay p95 yaklaşık 0,2 ms, kamera/render 15–19 ms ve statik katman tekrar çizilmedi. Buna rağmen başsız koşuda maksimum 3.844 ms yeniden üretildi.

## 4.4 Refuted as root cause — LLM/GPU/RAM baskısı

- **Hypothesis:** 8B modelin RAM/VRAM tüketimi sistemi durduruyor.
- **If true, we would also see:** Model yüklenmeden çalışan başsız simülasyonda saniyelik duraklama oluşmamalı; donma 4 saniyelik oyun saatine deterministik bağlanmamalı.
- **Discriminating test:** LLM ve Electron renderer olmadan hikâye simülasyonu çalıştır.
- **Status:** Refuted as necessary/root cause. Başsız Node koşusu aynı saniyelik uzun adımları üretti. Yüksek bellek baskısı gerçek oyunda şiddeti artırabilir, ancak bu arızanın oluşması için gerekli değildir.

## 4.5 Refuted as recurring root cause — Doğal yüzey/şehir atlasının ilk kurulumu

- **Hypothesis:** Büyük RAM katmanlarının kurulması her taşıt hareketinde yeniden gerçekleşiyor.
- **If true, we would also see:** Statik katman build sayısı taşıt adımlarıyla artar ve render ölçümü saniyelik olur.
- **Discriminating test:** Harita testinde build/hit sayaçlarını ve render p95'i izle.
- **Status:** Refuted for recurring freezes. Doğal yüzeyin ilk ısınması pahalı olsa da sonraki statik katmanlar tekrar kurulmadı; başsız repro yine dondu. İlk açılış ve yaklaşık 1,2 GB harita katmanı ayrı performans borcudur.

# 5) Mechanism

## Root cause

1. `storyAdvanceStep` her 4 saniyede tek bir senkron blok içinde ekonomi, bölgesel ekonomi, lojistik, piyasa, bütçe, şirket, inşaat ve ekonomik AI işlerini art arda çağırıyor (`js/Story.js:1652-1664`).
2. `storyTradeLogisticsTick` açık siparişleri, üretim girdilerini, otomatik dengeyi, Pareto üretim kabulünü ve hane dağıtımını aynı çağrıda bitirmeye çalışıyor (`js/StoryTrade.js:3176-3258`). Bu iş için kare/zaman bütçesi veya devam imleci yok.
3. Hane dağıtımı her gıda/enerji talebi için aynı ülkedeki bütün arz bölgelerini oluşturuyor; her aday için `storyInfrastructureFindRoute` çağırıyor, sonra yeniden filtreleyip sıralıyor (`js/StoryTrade.js:2970-3040`). Ölçüm: 12 saniyede 7.565 çağrı.
4. `storyInfrastructureFindRoute` her çağrıda bütün koridorları tarayarak adjacency haritasını yeniden kuruyor ve `open.sort()` kullanan bir en-kısa-yol araması yapıyor (`js/StoryInfrastructure.js:781-838`). Kaynak-hedef veya graf-revizyon önbelleği yok.
5. Sevkiyat denemeleri de `storyTradeDispatchOrder` üzerinden fiziksel rota planına giriyor (`js/StoryTrade.js:1055-1086`). `storyTradeFindRoute`, rota planlayıcıdaki mevcut önbelleği açıkça `useCache: false` ile devre dışı bırakıyor (`js/StoryTrade.js:737-756`). Ölçüm: 12 saniyede 2.346 dispatch girişi.
6. Bütün bunlar renderer'ın JavaScript ana iş parçacığında senkron yürüdüğünden, event loop sonuçlanana kadar çizim ve giriş işleyemez. Kullanıcı bunu taşıtların hareket ettiği anda donma olarak görür; taşıt yalnız aynı 4 saniyelik tetiğin görünür belirtisidir.
7. Fiziksel lojistik katmanı testte kapatılınca maksimum adım 1.474 ms'den 101,7 ms'ye indi. Böylece root cause çıkarıldığında saniyelik arıza oluşmadı.

## Contributing factors

- **Sıfır fazlı zamanlayıcı:** Bütün görevler `elapsedSeconds: 0` ile başlar (`js/StoryScheduler.js:11-40`, `js/StoryScheduler.js:57-69`); görevleri farklı karelere dağıtan faz/offset yoktur. 4 ve 5 saniyelik kümeler 20 saniyede bir çakışır.
- **İkinci pahalı katman:** `storyRegionalEconomyTick` bütün bölgelerde sektör üretimi, talep, depolama ve klonlama yapıyor (`js/StoryRegionalEconomy.js:815-1027`); maksimum 222 ms ölçüldü.
- **Tek tikte tamamlama zorunluluğu:** Lojistik iş listeleri dilimlenmiyor; 48 gibi bazı yerel dispatch limitleri all-pairs aday rota taramasını sınırlamıyor.
- **Veri hacmiyle kötü ölçeklenme:** Hane eşleştirmesi talep × aynı-ülke arz, rota araması ise her adayda tüm koridorlar + sıralı açık küme maliyeti taşır. Bölge/koridor sayısı arttıkça doğrusal değil çarpımsal büyür.

## Detection failure

- `storyTelemetryRecordStepDuration` yalnız toplam adım süresini tutuyor (`js/StoryTelemetry.js:259-285`); alt sistem adı ve oyun saatiyle uzun-task kaydı yok. Bu yüzden “lojistik mi, nüfus mu, render mı?” sorusu canlı rapordan cevaplanamıyor.
- Harita runtime testi dünyayı açıkça duraklatıyor (`electron/main.js:372`) ve yalnız `storyRender()`/overlay sürelerini ölçüyor (`electron/main.js:435-465`, `electron/main.js:696-706`). Simülasyonla render'ın aynı karedeki birleşik bütçesini test etmiyor.
- Çok modlu dikey testler doğruluk ve determinizmi kapsıyor; gerçekçi bölge sayısıyla “tek dünya adımı < 33 ms” performans kapısı yok.

**Weakest link:** Kullanıcının gördüğü tam ilk commit/tarih doğrudan kayıtlı değil. Buna karşılık mevcut arızanın mekanizması ve `6ece5a54` ile fiziksel rota entegrasyonunun eklenmesi kod geçmişi ve A/B ölçümüyle doğrudan doğrulanmıştır.

# 6) Remediation Options

## Mitigation — Pahalı kabul kapılarını geçici olarak sınırla

- **Title:** Hane/Pareto otomatik dağıtımını geçici özellik bayrağıyla kapat veya düşük sabit bütçeye indir
- **Category:** Immediate mitigation
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** `js/StoryFeatures.js:35-36`, `js/StoryTrade.js:3232-3255`
- **Evidence:** Hane katmanı kapalı maksimum 1.474 → 865 ms; hane+Pareto kapalı 551 ms.
- **Why it matters:** Kullanıcıya hemen daha az şiddetli donma verir fakat lojistiğin diğer kolları nedeniyle 60 FPS sağlamaz.
- **Recommended fix:** Kalıcı düzeltme gelene kadar `economy.householdDistributionAdmission` ve gerekirse `economy.paretoVolumeAdmission` varsayılanını kapat; alternatif olarak tik başına çok küçük aday/rota bütçesi ve deterministik devam imleci kullan.
- **Tradeoffs / Risks:** Hane arz dengesi ve üretim kabulü yavaşlar; ekonomi sonuçları değişir. Geçici olmalı ve sona erme koşulu kalıcı rota/bütçe düzeltmesinin doğrulanmasıdır.
- **Effort:** S
- **Change safety:** Needs Verification

## Fix — Rota matrisi + bütçeli deterministik lojistik iş kuyruğu

- **Title:** All-pairs rota aramasını graf revizyonuna bağlı ön-hesap ve kareler arası iş kuyruğuyla değiştir
- **Category:** Permanent fix
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** `js/StoryTrade.js:2939-3115`, `js/StoryTrade.js:3176-3258`, `js/StoryInfrastructure.js:766-839`, `js/StoryRoutePlanner.js:402-555`
- **Evidence:** 12 saniyede 7.565 altyapı rota araması ve 2.346 dispatch girişi; lojistik kapalı maksimum 101,7 ms.
- **Why it matters:** Donmayı kaldırırken fiziksel stok, kapasite, sınır erişimi ve deterministik taşıt lojistiğini koruyan çözüm budur.
- **Recommended fix:**
  1. Koridor adjacency'sini `networkHash/damageRevision/ownership/mode/access` revizyonuna göre bir kez kur.
  2. Hane dağıtımında her talep × her arz için rota aramak yerine ülke+mode bazlı erişilebilirlik/mesafe matrisi veya çok-kaynaklı ters rota ağacı kullan.
  3. Dispatch öncesinde kapasiteye bağlı son doğrulama yap; statik yol geometrisini yeniden çözme.
  4. Lojistik adaylarını deterministik sırada, örneğin kare başına 2–4 ms bütçeyle işle; iş kuyruğu imlecini state/save içinde sakla.
  5. Rezervasyon değişiminde bütün rota geometrisini geçersiz kılma; kapasite kullanılabilirliğini geometri önbelleğinden ayır.
- **Tradeoffs / Risks:** L/XL çalışma. Kuyruğa bölme ekonomik sonuç zamanını değiştirebilir; save/load determinizmi, sipariş sırası ve korunum testleri gerekir. Eski cache'in doğrudan açılması güvenli değildir çünkü rezervasyon kapasitesi canlıdır; geometri ve kapasite ayrı cache'lenmelidir.
- **Expected impact:** Saniyelik lojistik uzun-task'larının kaldırılması; kontrollü A/B tavanı mevcut 101,7 ms seviyesine, sonraki bölgesel ekonomi çalışmasıyla 16,7/33 ms bandına yaklaşmalıdır.
- **Change safety:** Needs Verification

## Prevention — Alt sistem süreleri ve canlı-simülasyon performans kapısı

- **Title:** Gerçek dünya zamanı açıkken per-task telemetry ve 33 ms CI bütçesi ekle
- **Category:** Detection / regression prevention
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `js/StoryTelemetry.js:259-285`, `electron/main.js:372`, story infrastructure tests
- **Evidence:** Mevcut telemetry yalnız toplam adımı, maptest ise duraklatılmış render'ı ölçüyor; regresyon testlerden geçti.
- **Why it matters:** Bir sonraki katman eklendiğinde aynı “doğru ama oynanamaz” regresyonu commit anında yakalar.
- **Recommended fix:** `storyAdvanceStep` görevlerini adlandırılmış sürelerle kaydet; 154+ bölge/gerçek koridor fixture'ında 60 oyun saniyesini 0,25 adımla çalıştıran CI testi ekle. Kabul kapısı: step p95 ≤ 16,7 ms, p99/max için başlangıçta ≤ 33 ms; ayrıca hiçbir görev tek başına 8 ms'yi aşmamalı. Maptestte kısa süre dünyayı açık tutup birleşik render+simülasyon long-task ölçümü yap.
- **Tradeoffs / Risks:** CI süresi artar; donanım varyansı için mutlak süre yanında çağrı/adet bütçeleri (rota araması/tik, dispatch/tik) de kullanılmalıdır.
- **Effort:** M
- **Change safety:** Safe

# 7) Verification Plan

1. Aynı seed 2032 ve 0,25 saniyelik adımla en az 60 oyun saniyesi çalıştır; baseline ile aynı telemetriyi al.
2. Başarı ölçütleri:
   - `storyAdvanceStep` p95 ≤ 16,7 ms.
   - p99 ve maksimum ≤ 33 ms; en azından hiçbir adım 100 ms'yi geçmemeli.
   - `storyInfrastructureFindRoute` çağrısı 4 saniyelik tik başına bölge-pair ölçeğinde olmamalı; cache/matris hit oranı raporlanmalı.
   - Lojistik iş kuyruğu deterministik biçimde ilerlemeli; seed ve save/load sonrası state hash eşitliği korunmalı.
3. A/B doğruluk: Eski ve yeni motoru aynı seedlerde 900 saniye koştur; kaynak korunumunu, teslim edilen miktarı, karşılanmayan talebi, sipariş/rezervasyon statülerini karşılaştır. Farklar tasarlanmış gecikmeden kaynaklanmalı, mal yaratma/kaybetme olmamalı.
4. Canlı Electron doğrulaması: Dünya zamanı açıkken 5 dakika kamera hareketi, şehir/hex UI ve taşıtları birlikte kullan; PerformanceObserver long-task sayısını ve en uzun görevin adını kaydet. 4/8/12/20 saniye kümelenmesi tekrarlanmamalı.
5. Kaynak baskısı: 8B LLM yüklü ve yüksüz iki tur çalıştır. LLM yalnız marjı etkileyebilir; lojistik görev bütçesi her iki koşuda da korunmalı.
6. İzleme süresi: İlk düzeltmeden sonra 30 dakikalık map-soak + simülasyon; ardından en az 8 seed × 900 saniye headless tarama.
7. Recurrence signal: 4 saniye aralıklı long-task tepeleri, tik başına yüzlerce/binlerce rota araması veya p99 > 33 ms arızanın geri geldiğini gösterir.
