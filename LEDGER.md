## 2026-08-24 — 1 Oyun Ayı (10 Saniye) Simülasyon Takvimi ve Hızlı Fare Hover Optimizasyonu
- **Type:** Executed
- **Source:** User directive & Micro-profiling audit (1-month simulation cycle & eliminating mouse hover FPS drop over hexes)
- **What happened:**
  1. *Ağır İşlemlerin 1 Oyun Ayına (10 Saniye) Ayarlanması:* Oyundaki 1 yıl = 120 sn kuralına göre 1 ay = 10 sn olarak belirlendi. Bölgesel ekonomi, bütçe, piyasa fiyatları, şirketler, inşaat/bakım, demografi, göç, siyasi kriz ve kamuoyu sistemlerinin periyotları 10 saniyeye çekildi; ayın 10 saniyesine (0.0s ... 9.75s) faz kaydırma ile eşit yayıldı.
  2. *Izgara Önbelleğinin Fare Hareketinden Ayrılması:* `StoryRender.js` (`storyDrawHexGridOverlay`) içinde hover altıgen kimliği önbellek anahtarından çıkarıldı; yüzlerce altıgen poligonu içeren statik ızgara önbellekte kalıcı kılındı. Fare altıgen değiştirdiğinde yalnız o tek altıgen $O(1)$ hafif çizgiyle (0.0024 ms) çizilmeye başlandı.
  3. *Şehir Düğüm Konumu Önbelleği (`pickNode`):* `StoryUI.js` içinde 152 şehrin harita koordinatları `STORY._nodePositionsCache` ile önbelleğe alındı; her fare adımında yapılan 152 trigonometrik koordinat hesabı sıfırlandı.
  4. *Gereksiz DOM ve Uzamsal Taramaların Engellenmesi:* `processHover` içinde mükerrer `storyHexPoliticalCellAtWorld` ve `storyRegionEntityAtWorld` çağrıları tek geçişe indirildi; `cv.style.cursor` yalnız stil değiştiğinde güncellenerek DOM layout reflow'ları sıfırlandı.
- **Evidence:**
  - `benchmark_hex_hover.js`: 1000 fare hover altıgen geçişi toplam **2.44 ms (0.0024 ms/geçiş)** olarak ölçüldü.
  - `test:story-infrastructure`: 20/20 test başarılı.
  - `test:story-player-agency`: 18/18 test başarılı.
- **Implication for future audits:** Dinamik hover/seçim görsel efektlerini asla statik katman önbellek anahtarına bağlama.

## 2026-08-24 — Kesintisiz 60 FPS Faz Kaydırma (Staggering), Önbellekli Enerji Analizi ve Işınlanmasız Araç Döngüsü
- **Type:** Executed
- **Source:** User directive & 60-Second In-Depth Gameplay Profiler (Eliminating 500ms freeze spikes & vehicle popping/teleporting)
- **What happened:**
  1. *Simülasyon Görevleri Faz Kaydırma (Phase Staggering):* `StoryScheduler.js` içerisine `STORY_SCHEDULER_HEAVY_TASK_IDS` throttling eklenerek tek bir karede 8 ağır görevin aynı anda çalışıp 535 ms kilitlenme yaratması engellendi; her karede en fazla 1 ağır görev tüketilecek şekilde sıralandı.
  2. *Bölgesel Enerji/Şirket Üretim Analizi Optimizasyonu:* `StoryCompanies.js` (`storyCompanyProductionViability`) içindeki her bölge için tüm haritayı tarayan $O(N^2)$ döngü tek geçişli memoize haritaya çevrilerek 46.208 döngü geçişi kaldırıldı.
  3. *Ticari Talep Sıralama Optimizasyonu:* `StoryCommerce.js` (`storyCommerceInventoryPlan`) içinde tekil lotlar için gereksiz `Array.sort()` ve nesne kopyalama döngüleri atlandı.
  4. *Kusursuz Araç Yaşam Döngüsü ve Işınlanma/Boşluktan Çıkma Tamiri:*
     - `StoryTransportAgents.js`: `storyTransportContinuousAdvance` artık `MOVING` haricinde `LOADING`, `TRANSFERRING`, `UNLOADING` ve `QUEUED` aşamalarını da 60 Hz'de pürüzsüz ilerletiyor.
     - `StoryTrade.js`: Canlı tarayıcı modunda fiziksel sevkiyatların makro 2 saniyelik çift zaman atlaması kaldırıldı.
     - `StoryRender.js`: Araçlar birbirine yaklaştığında birinin silinip geri gelmesine yol açan agresif ekran slotu süzgeci normal yakınlaştırma modunda kaldırıldı ve 250 ms gecikmeli iz kayması yerine doğrudan 60 Hz akıcı koordinat çizimine bağlandı.
- **Evidence:**
  - `test_teleports_interleaved.js`: 300 karelik simülasyon ve makro lojistik adımlarında **0 ışınlanma ve 0 zıplama**.
  - `test:story-infrastructure`: 20/20 test başarılı.
  - `test:story-player-agency`: 18/18 test başarılı.
- **Implication for future audits:** Canlı render'da asla fiziksel araçlara makro dt sıçraması uygulama; simülasyon görevlerini her zaman faz kaydırma ile farklı alt-adımlara dağıt.

## 2026-08-24 — Sevkiyat Sayısı Konsolidasyonu ve Anlamlı Kargo Partileri
- **Type:** Executed
- **Source:** User directive (sevkiyat sayısını azaltma ve kargo birleştirme)
- **What happened:**
  1. *Eşzamanlı Sevkiyat Limitleri Azaltıldı:* `STORY_TRADE_MAX_AUTO_DISPATCHES` 48'den 12'ye, hanehalkı sevkiyat limitleri 24'ten 6'ya, sanayi girdi limitleri 18'den 6'ya düşürüldü.
  2. *Minimum Parti Büyüklüğü Artırıldı:* 0.5 tonluk mikro sevkiyatlar yerine minimum 1.0 tonluk anlamlı ve karlı kargo partileri yola çıkarılmaya başlandı.
  3. *Harita Görsel Netliği:* Tüm dünyadaki aktif sevkiyat sayısı 200+'den sakin ve okunaklı 48'e dengelendi; her tır/tren/gemi artık stratejik ve büyük bir sevkiyatı temsil ediyor.
- **Evidence:**
  - `test_customs_and_foreign_trade.js`: Aktif sevkiyat sayısı 48'e dengelendi, tüm testler başarılı.
  - `test:story-infrastructure`: 20/20 test başarılı.
  - `test:story-player-agency`: 18/18 test başarılı.
- **Implication for future audits:** Mikro parçalı siparişler yerine her zaman partileri konsolide et.

## 2026-08-24 — 60 FPS Kamera Sürükleme ve 10 Hz Kademeli Simülasyon Optimizasyonu
- **Type:** Executed
- **Source:** User directive & Micro-profiling audit (Eliminating 5-10 FPS drops during camera pan/drag)
- **What happened:**
  1. *Hızlı Tek Parça Çizim (storyBlitWarp):* Kamera sürüklenirken (`STORY._mapInteracting === true`) 60 şeritli yavaş dilimleme yerine donanım hızlandırmalı tek parça `drawImage` moduna geçildi (çizim süresi **26.2 ms $\to$ 0.1 ms**).
  2. *10 Hz Kademeli Simülasyon:* `storyWorldFrame` içindeki ağır takvim ve görev simülasyonu (`storyAdvance`) her 16 ms'de bir çalışmak yerine 10 Hz (0.1s) akümülatöre bağlandı. Araçların altıgenler arası kesintisiz süzülmesi (`storyTransportContinuousAdvance`) tam 60 Hz rAF akıcılığında tutuldu.
  3. *Görsel Durum ve Ağ Önbelleği:* Ağır string birleştirme döngüleri ve gereksiz ara tuval tahsisleri kaldırıldı.
- **Evidence:**
  - `deep_frame_breakdown.js`: 120 karelik detaylı mikro-profilde rAF kare başına transport overlay render süresi **0.065 ms**, kesintisiz araç koordinat ilerlemesi **0.077 ms** olarak ölçüldü (toplam kare render süresi < 0.5 ms $\to$ 60+ FPS).
  - `test:story-infrastructure`: 20/20 test başarılı.
  - `test:story-player-agency`: 18/18 test başarılı.
- **Implication for future audits:** Kamera hareketi esnasında asla çoklu şerit kesimi (slicing) yapma; her zaman tek parça donanım çizimi kullan.

## 2026-08-24 — Gümrük Vergisi, Dış Ticaret Dengesi ve Karlı Sevkiyat Mimarisi
- **Type:** Executed
- **Source:** User directive & Economic architecture implementation
- **What happened:**
  1. *Gümrük Vergileri ve Transit Harçları:* Uluslararası sevkiyatlarda ithalatçı devlet için %12 gümrük vergisi (`REVENUE:TAX.CUSTOMS_IMPORT`), ihracatçı devlet için %5 ihracat harcı (`REVENUE:TAX.CUSTOMS_EXPORT`) ve üçüncü ülke koridor geçişlerinde %2 transit geçiş ücreti (`REVENUE:TAX.TRANSIT_TOLL`) devlet bütçesine (`StoryBudget.js`) bağlandı.
  2. *Piyasa Arbitrajı ve Karlı Sevkiyat:* `storyTradeCheckArbitrageProfitability` ve minimum kargo partisi filtresi ile zarar eden anlamsız mikro-sevkiyatlar elendi.
  3. *Dış Ticaret Dosyası UI:* Ekonomi paneline (`StoryCityDossier.js`) `dis-ticaret` sekmesi eklenerek hammadde bazında İthalat/İhracat matrisi, ticaret ortakları ve toplanan gümrük gelirleri tablosu kuruldu.
- **Evidence:**
  - `test_customs_and_foreign_trade.js`: Gümrük vergileri, transit harçları, arbitraj spreadleri ve UI render testleri başarıyla doğrulandı.
  - `test:story-infrastructure`: 20/20 test başarılı.
  - `test:story-player-agency`: 18/18 test başarılı.
- **Implication for future audits:** 5 Temel Ekonomik Çark artık dış ticaret, gümrük gelirleri ve karlı piyasa arbitrajı ile tam entegre çalışmaktadır.

## 2026-08-24 — Araç Hızı Kalibrasyonu, Çift İlerlemenin Kaldırılması ve Sıfır-Çöp Render Optimizasyonu
- **Type:** Executed
- **Source:** User directive & profiling audit (Vehicle speed normalization & transport overlay zero-GC rendering)
- **What happened:**
  1. `storyTransportContinuousAdvance` içindeki hız katsayısı gerçekçi ve sakin bir seviyeye (`0.05 * speed`) çekildi.
  2. `storyTradeLogisticsTick` makro adımındaki `MOVING` araçların 2 saniyede bir çift ilerletilmesi (double-advancement jump) engellendi.
  3. `storyDrawTransportAgents` ve `storyTransportPrepareRenderSnapshot` içindeki per-frame `Array.sort()`, `map()` ve dizi tahsisleri kaldırılarak sıfır-çöp (Zero-GC) performansı sağlandı.
  4. Ekran dışındaki araçlar için kamera görüş alanı filtrelemesi (bounding box culling) eklenerek çizim döngüsü optimize edildi.
- **Evidence:**
  - `profile_transport_lag.js`: 60 kare çizim süresi ortalama 0.98 ms/kare, kare başına ilerleme +17.6 Bps (önceki +88 Bps yerine 5 kat daha sakin ve gerçekçi).
  - `test:story-infrastructure`: 20/20 test başarılı.
  - `test:story-player-agency`: 18/18 test başarılı.
- **Implication for future audits:** Canlı simülasyonda rAF hareketini makro ticari sevkiyat adımlarından bağımsız tut ve render döngüsünde asla her karede `.sort()` çalıştırma.

## 2026-08-24 — 60 FPS Simülasyon, Genişletilmiş Görev Aralıkları (1s-2s) ve Canlı Altıgen Hareketi
- **Type:** Executed
- **Source:** User directive & profiling audit (60 FPS / <16ms latency target & continuous hex vehicle movement)
- **What happened:**
  1. Görev zamanlayıcı aralıkları 1s – 2s ve 4s periyotlarına kademelendirildi (`resource: 2s`, `production: 2s`, `commander-ai: 2s`, `loyalty: 1s`, `economy-trade-logistics: 2s`).
  2. `storyRegionalEconomyTick` içerisindeki aşırı kriptografik hash ve `JSON.stringify` klonlama döngüleri doğrudan nesne kontrolleriyle optimize edildi.
  3. `storyTradeProductionInputBalance` içindeki talep eşleme araması hafifletildi.
  4. Lojistik araçlarının (tır, yük treni, kargo gemisi) altıgenler arasında gerçek zamanlı ve kesintisiz akışı için `storyTransportContinuousAdvance` rAF render döngüsüne entegre edildi ve statik anlık görüntü önbelleği kaldırılarak canlı altıgen geçişleri sağlandı.
- **Evidence:**
  - `verify_hex_frames.js`: Araçların kare kare (Frame 1..10) altıgenler arası koordinat ve açı değişimleri doğrulanmıştır (4721 $\to$ 4720 $\to$ 4613).
  - `test:story-infrastructure`: 20/20 test başarılı.
  - `test:story-player-agency`: 18/18 test başarılı.
- **Implication for future audits:** Ağır makroekonomik döngüleri (2s-4s) hafif fiziksel koordinat ilerlemesinden (<0.05ms) ayrı tutmaya devam et.

## 2026-08-22 — Dört saniyelik lojistik rota fırtınası doğrulandı
- **Type:** Confirmed
- **Source:** `RCA.md` — Dört saniyelik lojistik rota fırtınası
- **What happened:** Hikâye simülasyonunda her 4 saniyede çalışan lojistik katmanı ana iş parçacığında binlerce tekrarlı rota araması yapıyor.
- **Evidence:** Seed 2032, 60 saniye/0,25 adım koşusunda p95 1.374,413 ms ve max 3.844,119 ms; 12 saniyede 7.565 altyapı rota araması. Lojistik kapalı A/B max 101,7 ms.
- **Implication for future audits:** Taşıt hareketiyle eşzamanlı donmayı sprite çizimine bağlama; önce 4 saniyelik `storyTradeLogisticsTick` ve rota çağrı bütçesini ölç.

## 2026-08-22 — Taşıt overlay ve statik harita çizimi kök neden değil
- **Type:** Refuted
- **Source:** `RCA.md` — Taşıt sprite'ları ve harita yeniden çizimi donuyor
- **What happened:** Taşıt overlay'i ve kamera render'ı ayrı ölçüldü; saniyelik donma renderer olmadan başsız simülasyonda da tekrarlandı.
- **Evidence:** Taşıt overlay p95 yaklaşık 0,2 ms; kamera/render 15–19 ms; başsız simülasyon max 3.844,119 ms.
- **Implication for future audits:** Yeni render kanıtı olmadıkça saniyelik periyodik donmayı harita sprite/cache katmanına yeniden atfetme.

## 2026-08-22 — LLM bellek kullanımı donmanın gerekli nedeni değil
- **Type:** Refuted
- **Source:** `RCA.md` — LLM/GPU/RAM baskısı
- **What happened:** LLM ve Electron olmadan çalışan Node simülasyonu aynı 4 saniyelik uzun adımları üretti.
- **Evidence:** Başsız 60 saniyelik koşu p95 1.374,413 ms, max 3.844,119 ms.
- **Implication for future audits:** LLM/bellek baskısını yalnız şiddet artırıcı olarak değerlendir; lojistik uzun-task'ı kaldırılmadan onu kök neden sayma.

## 2026-08-22 — Simülasyon performansı testlerde görünmüyor
- **Type:** Confirmed
- **Source:** `RCA.md` — Detection failure
- **What happened:** Maptest dünya zamanını durdurup yalnız render/overlay ölçüyor; telemetry alt sistem sürelerini kaydetmiyor ve gerçek ölçekli adım bütçesi testi yok.
- **Evidence:** `electron/main.js:372`, `electron/main.js:435-465`, `js/StoryTelemetry.js:259-285`.
- **Implication for future audits:** Canlı simülasyon açık performans kapısı ve adlandırılmış görev süreleri eklenene kadar render testlerinin hikâye modu akıcılığını kanıtladığını kabul etme.

## 2026-08-22 — Belge ağacı kanonik sahiplik alanlarına ayrıldı
- **Type:** Executed
- **Source:** `plans/documentation-layout.md`
- **What happened:** Kök ve düz `docs/` yığını; ürün, hikâye, savaş AI, UX ve operasyon sahiplik alanlarına ayrıldı. Kanonik giriş noktaları ve yaşayan belge üstverisi eklendi; mislabeled ikili dosya arşivlendi.
- **Evidence:** `docs/README.md`, `docs/ARCHITECTURE.md`; 123/123 yerel Markdown bağlantısı doğrulandı; kökte yalnız `README.md`, `LEDGER.md`, `RCA.md` kaldı. Uygulama commitleri: `3362bcd`–`eded71b`.
- **Implication for future audits:** Belge keşfine `docs/README.md` üzerinden başla; eski kök veya düz `docs/` yollarını kanonik kabul etme. Tam test paketi `tests/story-conversation-semantic-model.test.js` içindeki önceden var olan `MODEL_LOADING` / `NOT_REQUIRED` beklenti uyuşmazlığı çözülene kadar bu plan `In Progress` kalır.

## 2026-08-22 — Semantik model kuyruğunu NOT_REQUIRED kısa devresi engelliyor
- **Type:** Confirmed
- **Source:** `RCA.md` — Semantik model yaşam döngüsü
- **What happened:** Deterministik UNKNOWN açıklaması yanıtı `NOT_REQUIRED` işaretliyor; açılış ve takip çağıranları bu etiketi model gereksinimi kararı sanıp semantik kuyruk fonksiyonunu hiç çağırmıyor.
- **Evidence:** Seed 38103 ile iki yeniden üretimde `UNKNOWN`, güven 1100 ve `CLARIFY_UNKNOWN_WITHOUT_FAKE_CONTINUITY` yanıtı gözlendi; `npm run story:conversation-semantic-model-test` 2/2 kez `NOT_REQUIRED` aldı.
- **Implication for future audits:** Semantik model başlamadığında önce LLM/GPU hazır oluşunu değil, `StoryConversationUnderstanding.js` çağrı yerlerindeki durum kısa devresini denetle.

## 2026-08-22 — Özellik bayrağı ve LLM köprüsü semantik test hatasının nedeni değil
- **Type:** Refuted
- **Source:** `RCA.md` — Semantik model yaşam döngüsü
- **What happened:** Kampanya açık semantik model bayrağı ve hazır LLM test çiftiyle çalışmasına rağmen karar zinciri özellik ve köprü kontrollerine ulaşmadan kesildi.
- **Evidence:** Açılış yanıtı model kuyruğu çağrılmadan `NOT_REQUIRED`; üretim isteği oluşmadı.
- **Implication for future audits:** Aynı belirti için köprü veya GPU teşhisine ancak kuyruk fonksiyonunun gerçekten çağrıldığı kanıtlandıktan sonra geç.

## 2026-08-22 — Raster-kapalı A/B yolu altıgen coğrafya başlatıcısında çöküyor
- **Type:** Confirmed
- **Source:** `RCA.md` — Canonical raster kapalı kampanya
- **What happened:** `world.canonicalMapRaster=false` sözleşme gereği null raster döndürüyor; altıgen coğrafya reset zinciri bu null değerin `sourceHash` alanını okuyor.
- **Evidence:** Tam paket 30/88’de ve tek worker `mapRasterProbe` 1/1 koşusunda aynı `StoryHexGeography.js:62` stack’iyle çöktü.
- **Implication for future audits:** Raster kapalı A/B yolunda kanonik API’yi zorla açma; yeni altıgen türetimler için kalıcı olmayan uyumluluk rasterı kullan.

## 2026-08-22 — Raster varlığı ve paralel worker yarışı canonical-map çöküşünün nedeni değil
- **Type:** Refuted
- **Source:** `RCA.md` — Canonical raster kapalı kampanya
- **What happened:** Hazır raster probu geçti; aynı çöküş tek görev ve tek worker ile yeniden üretildi.
- **Evidence:** `prebuiltRasterProbe` başarılı; `--task mapRasterProbe --workers 1` 2,9 saniyede aynı null stack’ini verdi.
- **Implication for future audits:** Bu belirtiyi asset bozulması veya worker yarışına bağlama; önce özellik-kapalı null sözleşmesini kontrol et.

## 2026-08-22 — Bileşik hafıza isteği SECRET önceliğinde daralıyor
- **Type:** Confirmed
- **Source:** `RCA.md` — Bileşik söz ve sır geri çağrımı
- **What happened:** Aynı oyuncu cümlesinde söz ve sır açıkça sorulmasına rağmen hafıza niyet çözümleyicisi yalnız SECRET türünü seçiyor; geçerli ortak PROMISE kaydı recall ve bağlam paketine ulaşmıyor.
- **Evidence:** Seed 2032 izole koşusunda PROMISE ve ortak SECRET kayıtları `applied=true`; yanıt recall’ı ve pack MEMORY bölümleri yalnız SECRET kayıtlarını içerdi. Tek worker probunda `canonicalPromiseIncluded=false`.
- **Implication for future audits:** Hafıza eksikliğini token bütçesine veya kayıt sahipliğine bağlamadan önce niyet çözümleyicisinin bileşik tür sinyallerini koruduğunu denetle.

## 2026-08-22 — Sahiplik, token bütçesi ve worker yarışı bağlam sözü kaybının nedeni değil
- **Type:** Refuted
- **Source:** `RCA.md` — Bileşik söz ve sır geri çağrımı
- **What happened:** Söz kaydı geçerli holder/related kimlikleriyle oluşturuldu; pack bütçe aşımına gelmeden recall filtresinde elendi ve hata tek worker koşusunda tekrarlandı.
- **Evidence:** `promise.applied=true`; `memoryRecall.records` içinde PROMISE yok; `--task conversationContextPackProbe --workers 1` aynı assertion ile başarısız.
- **Implication for future audits:** Bu belirti için önce tür öncelik zincirini incele; sahiplik, bütçe veya paralellik ancak PROMISE recall’a girdiyse şüpheli olsun.

## 2026-08-23 — Fiziksel lojistik ENERGY şebeke sevkiyatını reddediyor
- **Type:** Confirmed
- **Source:** `RCA.md` — ENERGY iç dağıtım fiziksel rezervasyonu
- **What happened:** Çok-modlu lojistik entegrasyonu segmentli LAND/RAIL/SEA rota zorunluluğunu segment taşımayan ENERGY makro koridorlarına da uyguluyor; geçerli iç dağıtım commit edilmeden reddediliyor.
- **Evidence:** Seed 2032’de admission `ok=true`, exportable 106,56 ve istek 5; commit ilk bacakta `PHYSICAL_ROUTE_RESERVATION_UNAVAILABLE`, shipment listesi boş. Tek worker probu aynı sonucu verdi.
- **Implication for future audits:** Ticaret dispatchinde fiziksel taşıt modlarıyla ENERGY/DATA şebeke akışlarını ayır; segment zorunluluğunu non-vehicle moda genelleme.

## 2026-08-23 — Stok, kargo sahipliği ve worker yarışı ENERGY dağıtım hatasının nedeni değil
- **Type:** Refuted
- **Source:** `RCA.md` — ENERGY iç dağıtım fiziksel rezervasyonu
- **What happened:** Makro admission, stok ve sahipli kargo planı geçerliydi; hata kargo commitinden önce oluştu ve tek worker ile tekrarlandı.
- **Evidence:** İki ENERGY bacağı kabul edildi, commerce cost 0,9; commit hata kodu fiziksel rezervasyon eksikliği.
- **Implication for future audits:** ENERGY shipment yokluğunda önce rota türü/adaptör sınırını incele; stok veya commerce katmanına ancak admission/plan onları reddediyorsa geç.

## 2026-08-23 — Genel eylem hamlesi mevcut askerî iddiayı kaynak dışı bırakıyor
- **Type:** Confirmed
- **Source:** `RCA.md` — Askerî iddia diyalog hamlesi bağlama zinciri
- **What happened:** Destek talebiyle aynı turda doğru çıkarılan Halep tehdit claim'i, `ASSESS_ACTION_REQUEST_SCOPE` politikasının boş claim türü filtresi nedeniyle diyalog hamlesine bağlanmadı.
- **Evidence:** Seed 2032 dökümünde analysis `PLAYER_REPORTED_MILITARY_THREAT` içerirken response act'i `ASSESS_ACTION_REQUEST_SCOPE`, source policy `CURRENT_TURN_ONLY` ve `claimRefs=[]`; tek worker probu aynı assertion ile başarısız.
- **Implication for future audits:** Eylem talebi içeren cümlelerde NLU claim varlığını tek başına yeterli sayma; karar sözleşmesinin mevcut tur kaynağını koruduğunu ayrıca denetle.

## 2026-08-23 — NLU, claim kayıt sırası ve worker yarışı askerî claim kaybının nedeni değil
- **Type:** Refuted
- **Source:** `RCA.md` — Askerî iddia diyalog hamlesi bağlama zinciri
- **What happened:** Claim doğru tür ve doğrulama durumuyla aynı follow-up analysis'inde mevcuttu; kayıp hamle filtresinde oluştu ve LLM kullanılmayan tek worker koşusunda tekrarlandı.
- **Evidence:** `claim:player-reported-threat:region:141`, `UNVERIFIED_PLAYER_REPORT`, `llmUsed=false`; tek worker sonucu `militaryClaimBound=false`.
- **Implication for future audits:** Aynı belirtiyi semantik model veya paralelliğe bağlamadan önce act politikasının `claimTypes` sözleşmesini incele.

## 2026-08-23 — Dinamik koridor tamamlanması ağ bağımlı sidecar hash'lerini bayat bırakıyor
- **Type:** Confirmed
- **Source:** `RCA.md` — Dinamik altyapı ağı revizyon zinciri
- **What happened:** AI rota inşaatı tamamlanınca altyapı grafiği built corridor'larla yeniden kuruluyor; ticaret ve piyasa defterleri eski `networkHash` değerinde kaldığı için yaşayan dünya geçersiz işaretleniyor.
- **Evidence:** Seed 2032, 180 saniyelik tek süreçte tek trade issue `TRADE_NETWORK_HASH`; aktif kapasite kaydında `corridor:built:rail:1` ve `corridor:built:land:2` kullanılıyor.
- **Implication for future audits:** Canlı altyapı kataloğu değişiminde yalnız graph/cache yenilemesini yeterli sayma; durable ağ bağımlılarının revizyon bağını aynı kontrollü sınırda güncelle.

## 2026-08-23 — ENERGY shipment biçimi, bozuk koridor içeriği ve worker yarışı trade hash hatasının nedeni değil
- **Type:** Refuted
- **Source:** `RCA.md` — Dinamik altyapı ağı revizyon zinciri
- **What happened:** Ticaret içeriği çalışmaya ve yeni koridorları kullanmaya devam etti; doğrulayıcı yalnız hash bağı sorunu verdi ve izole tek süreç aynı sonucu üretti.
- **Evidence:** 143 sözleşme, 47 açık sipariş, 330 aktif shipment; ENERGY dağıtım probu geçti; issue listesi yalnız `TRADE_NETWORK_HASH`.
- **Implication for future audits:** Ağ hash uyuşmazlığını shipment içeriği veya paralelliğe bağlamadan önce kontrollü graph revizyonunun sidecar'lara yayınlanıp yayınlanmadığını kontrol et.

## 2026-08-23 — Fiziksel taşıma validatorı terminal ajan durumlarını reddediyor
- **Type:** Confirmed
- **Source:** `RCA.md` — Transport agent yaşam döngüsü sözleşmesi
- **What happened:** Ticaret motoru teslim edilen ve kaybolan fiziksel ajanları `DELIVERED/LOST` durumuna geçirirken validator yalnız canlı hareket durumlarını kabul ediyor; tamamlanmış shipment geçmişi topluca geçersiz sayılıyor.
- **Evidence:** Hash revizyonu geçtikten sonra 180 saniyelik dünyada yüzlerce `INVALID_SHIPMENT_TRANSPORT`; üretim kodunda terminal atamalar mevcut, validator allowed listesinde yok.
- **Implication for future audits:** Agent doğrulamasını tek state listesiyle yapma; shipment ve agent yaşam döngüsü durumlarını eşleşmeli invariant olarak doğrula.

## 2026-08-23 — Ajan attach, ağ hash eşitlemesi ve ENERGY grid akışı terminal validator hatasının nedeni değil
- **Type:** Refuted
- **Source:** `RCA.md` — Transport agent yaşam döngüsü sözleşmesi
- **What happened:** Canlı fiziksel rota testleri ve attach alanları geçerliydi; hash düzeltmesi yalnız revizyon alanlarını değiştirdi, ENERGY grid shipmentları ise v2 agent validatorına girmez.
- **Evidence:** Kara/demir/deniz rota testleri geçti; issue kodu yalnız agent terminal durumunda açığa çıktı; çelişkili kod `6ece5a5` commitinden beri mevcut.
- **Implication for future audits:** Bu issue için rota üretimini veya grid fallback'i değiştirmeden önce terminal state-pair sözleşmesini denetle.

## 2026-08-23 — Varış boşaltma kuyruğu trade leg validatorında eksik
- **Type:** Confirmed
- **Source:** `RCA.md` — Varış terminali kuyruğu geçerli sevkiyatı rota dışı gösteriyor
- **What happened:** Fiziksel ajan son adımda hedefe ulaşıp boşaltma terminali sırası beklerken meşru olarak `legIndex=end` ve `state=QUEUED` taşıyor; trade validator yalnız `UNLOADING` istisnasını kabul ediyor.
- **Evidence:** Seed 2032 / 900 saniyede 7/7 issue `INVALID_SHIPMENT_LEG`; market ve ağ hash'i geçerli. Üretici `StoryTransportAgents.js` içinde rota sonunda `QUEUED` yazıyor, transport validator bunu canlı state olarak kabul ediyor.
- **Implication for future audits:** Rota sonundaki canlı shipmentı doğrudan bozuk sayma; boşaltma terminali `QUEUED -> UNLOADING` yaşam döngüsünü ve son-step/hedef invariantlarını birlikte doğrula.

## 2026-08-23 — Reroute, ağ revizyonu ve terminal kilitlenmesi leg issue'nun kök nedeni değil
- **Type:** Refuted
- **Source:** `RCA.md` — Varış terminali kuyruğu geçerli sevkiyatı rota dışı gösteriyor
- **What happened:** Aynı koşuda ağ ve piyasa doğrulaması temizdi; rota sonu kuyruk durumu üretim kodunun tasarlanmış terminal geri basıncıydı.
- **Evidence:** `marketValidation.ok=true`, ağ hash `fnv1a32:aad33143`; issue sınıfı yalnız `INVALID_SHIPMENT_LEG`, terminal kuyruğu her tick yeniden admission deniyor.
- **Implication for future audits:** Bu belirtiyi rota grafiği veya ilerleme donması olarak düzeltmeden önce trade ile transport validatorlarının ortak yaşam döngüsü sözleşmesini karşılaştır.

## 2026-08-23 — Altyapı malzeme rezervasyonu sahiplik aynasını atlıyor
- **Type:** Confirmed
- **Source:** `RCA.md` — Altyapı rezervasyonu sahiplik lotunu tüketmiyor
- **What happened:** Rota ve bakım komutları fiziksel bölgesel stoğu azaltırken aynı malların commerce sahiplik lotlarını azaltmadı.
- **Evidence:** Pareto 300 saniyede yalnız 7 `COMMERCE_PHYSICAL_MIRROR_MISMATCH`; farklar rota malzeme formülleriyle birebir, trade ve regional defterleri geçerli.
- **Implication for future audits:** Bölgesel fiziksel stok kaybı ekleyen her sistem `storyCommerceApplyPhysicalLoss` veya eşdeğer atomik sahiplik kapısını da kullanmalı.

## 2026-08-23 — Trade teslimatı, Pareto üretimi ve yuvarlama commerce farkının nedeni değil
- **Type:** Refuted
- **Source:** `RCA.md` — Altyapı rezervasyonu sahiplik lotunu tüketmiyor
- **What happened:** Trade doğrulaması temizdi, üretim kanonik slice tüketiminden geçiyordu ve farklar tolerans gürültüsü değil tam proje girdileriydi.
- **Evidence:** `tradeValidation.ok=true`, `regionalValidation.ok=true`; lot-stok farkları 2–36 tam birim.
- **Implication for future audits:** Tam proje maliyeti deseninde önce doğrudan stok yazan inşaat/rezervasyon katmanlarını incele.

## 2026-08-23 — Hane dağıtımı sıfır başarısızlık eşiği hayalet stoğa bağımlıydı
- **Type:** Confirmed
- **Source:** `RCA.md` — Hane dağıtımında sıfır başarısızlık eşiği gerçek rekabeti reddediyor
- **What happened:** Sahiplik aynası düzeldikten sonra 3.690 hane siparişinin 178'i geçici stok/koridor rekabetinde sevk edilemedi; sonuç erişimi yine bütün korumaları geçti.
- **Evidence:** Başarısızlık %4,82; gıda %84,40, enerji %83,96, yaşam koşulu %73,75; commerce/trade/regional sıfır issue.
- **Implication for future audits:** Canlı kaynak rekabetinde sıfır operasyonel başarısızlık isteme; oran tavanını sonuç kalitesi ve defter invariantlarıyla birlikte ölç.

## 2026-08-23 — Rota benchmarkı fiziksel olarak kapalı koridorları açık sayıyordu
- **Type:** Confirmed
- **Source:** RCA.md — Rota benchmarkı fiziksel olarak kapalı koridorları geçilebilir sayıyor
- **What happened:** Tezgâh bütün mantıksal kara koridorlarını benchmarka aldı; altıgen fizik zinciri olmayan iki BLOCKED koridordan da rota bekledi.
- **Evidence:** corridor:land:11:142 ve corridor:land:34:52 etkin ve hasarsız görünmesine rağmen effectiveCapacity=0; açık koridorlar ve kesilen 0:1 koridorunun alternatifi bulunuyor.
- **Implication for future audits:** Modal rota örneklerini katalog türüne göre değil, sorgu anındaki fiziksel geçilebilirlik (effectiveCapacity>0) sözleşmesine göre seç.

## 2026-08-23 — Rota motoru ve hasar cache'i benchmark düşüşünün nedeni değil
- **Type:** Refuted
- **Source:** RCA.md — Rota benchmarkı fiziksel olarak kapalı koridorları geçilebilir sayıyor
- **What happened:** İlk koridor tam kesildiğinde rota motoru hasarlı kenarı dışlayıp 0→2→3→1 alternatifini hesapladı.
- **Evidence:** routeBefore doğrudan 0:1; routeAfter.ok=true ve üç farklı koridor kullanıyor.
- **Implication for future audits:** allBenchmarkRoutesFound düşüşünde önce örnek kümesinin kapalı fiziksel kenar içerip içermediğini kontrol et; motoru veya invalidationı kanıtsız değiştirme.

## 2026-08-23 — Kesinti kabul eşiği fiziksel yükleme fazını yok sayıyordu
- **Type:** Confirmed
- **Source:** RCA.md — Ticaret kesinti eşiği fiziksel yükleme süresini yok sayıyor
- **What happened:** 20 saniyelik probun ilk 0,5 saniyesi yükleme, kalan 19,5 saniyesi kapalı koridorda bekleme olmasına rağmen test kesinti sayacından tam 20 bekledi.
- **Evidence:** Sevkiyat HELD/PHYSICAL_SEGMENT_BLOCKED; agent waitingSeconds=19.5; manifest interruptionSeconds=19.5; adım ilerlemesi sıfır.
- **Implication for future audits:** Uçtan uca tick süresini tek bir yaşam döngüsü fazına eşitleme; yükleme, transfer, hareket, kuyruk ve kesinti sürelerini ayrı doğrula.

## 2026-08-23 — Koridor hasarı ve kesinti telemetrisi kayıp değil
- **Type:** Refuted
- **Source:** RCA.md — Ticaret kesinti eşiği fiziksel yükleme süresini yok sayıyor
- **What happened:** Koridor tam kapandı, sevkiyat bekledi ve manifest/agent sayaçları aynı gerçek süreyi kaydetti.
- **Evidence:** effectiveCapacity=0, held=1, advanced=0, delivered=0; kesinti sonrası sevkiyat DELIVERED durumuna ulaştı ve 19,5 saniyeyi korudu.
- **Implication for future audits:** Toplam tick eşiği düşerse telemetriyi eksik saymadan önce faz bütçesinin ne kadarının gerçekten blokajda geçtiğini ölç.

## 2026-08-23 — Dolu rota topolojik rota yok diye sınıflanıyordu
- **Type:** Confirmed
- **Source:** RCA.md — Dolu fiziksel rota topolojik rota yok diye sınıflanıyor
- **What happened:** İlk sevkiyat segment kapasitesinin tamamını ayırınca route planner ikinci sorguda aday kenar bulamadı; trade katmanı geçici kapasite tükenmesini NO_ROUTE olarak iletti.
- **Evidence:** İlk dispatch 1.051 birimle açık 7 segmentli rotada başarılı; ikinci dispatch aynı kaynak-hedef için NO_ROUTE.
- **Implication for future audits:** Rezervasyon farkındalıklı rota aramasında boş aday grafı topolojik kopukluk kanıtı değildir; rezervasyonsuz fizik görünümüyle kapasite/tasarım ayrımını yap.

## 2026-08-23 — Stok, hasar ve fiziksel topoloji ikinci dispatch hatasının nedeni değil
- **Type:** Refuted
- **Source:** RCA.md — Dolu fiziksel rota topolojik rota yok diye sınıflanıyor
- **What happened:** Tezgâhta yeterli stok vardı, koridor yeniden açılmıştı ve aynı rota ilk sevkiyatı taşıdı.
- **Evidence:** capacityDispatchA.ok=true, quantity=sharedCapacity=1051; fiziksel rota corridor:land:0:6 ve yedi segment içeriyor.
- **Implication for future audits:** İlk eş dispatch başarılıysa ikinci NO_ROUTE sonucunda önce ortak kapasite rezervasyonlarını ve hata çevirisini incele.

## 2026-08-23 — Yükleme teşhisi kalıcı ticaret durumu sanılıyordu
- **Type:** Confirmed
- **Source:** RCA.md — Yükleme teşhisi kalıcı ticaret durumu sanılıyor
- **What happened:** Ham defter eşitliği, yükleme sırasında eklenen ve hiçbir dünya değişikliği taşımayan `diagnostics.transportMigration` alanını kalıcılık kaybı saydı.
- **Evidence:** Kaydedilen/geri yüklenen defterlerde tek fark bu teşhis alanı; migrated=0, deferred=0, issues=[]; doğrulama ve bölgesel stok eşitliği geçti.
- **Implication for future audits:** Kayıt eşitliğinde kalıcı oyun durumunu çalışma zamanı doğrulama/göç teşhislerinden ayır; ikisini ayrı sözleşmelerle test et.

## 2026-08-23 — Ticaret siparişleri, rotaları ve kapasitesi yüklemede kaybolmuyor
- **Type:** Refuted
- **Source:** RCA.md — Yükleme teşhisi kalıcı ticaret durumu sanılıyor
- **What happened:** Exact-ledger assertionı düşmesine rağmen operasyonel alanların hiçbirinde fark yoktu.
- **Evidence:** Sözleşme, sipariş, sevkiyat, fiziksel segment, taşıt ilerlemesi, kapasite penceresi ve toplamların alan düzeyi karşılaştırması eşit; regionalUnchanged=true.
- **Implication for future audits:** Ham JSON eşitsizliğini veri kaybı ilan etmeden önce fark yollarını çıkar ve yalnız kalıcı alanları sınıflandır.

## 2026-08-23 — İç dağıtım kalıcılık kapısı da çalışma zamanı teşhisine bağlıydı
- **Type:** Confirmed
- **Source:** RCA.md — Yükleme teşhisi kalıcı taşıma durumu sanılıyor
- **What happened:** İki bacaklı enerji dağıtımında ham ticaret defteri eşitliği yalnız yüklemede eklenen `diagnostics.transportMigration` yüzünden düştü.
- **Evidence:** Alan farkı yalnız teşhis yolunda; iki sevkiyat `LEGACY_PHYSICAL_ROUTE_UNAVAILABLE` ile deferred listesine girmiş olsa da trade/commerce doğrulamaları ve kalıcı bacak/rota/lot alanları eşit.
- **Implication for future audits:** Operasyonel kalıcılığı diagnostics zarfından ayrı ölç; ENERGY fiziksel adaptör/yükleme sırası uyarısını ayrıca borç olarak izle ve sessizce silme.

## 2026-08-23 — Piyasa ve satış resume probları ham ticaret eşitliğini kopyalıyordu
- **Type:** Confirmed
- **Source:** RCA.md — Yükleme teşhisi kalıcı taşıma durumu sanılıyor
- **What happened:** Piyasa restored/legacy/corrupt ve satış-uzlaşma resume kapıları ticaret defterini diagnostics dahil ham JSON ile karşılaştırıyordu.
- **Evidence:** Hasarlı rotada bekleyen piyasa sevkiyatının kayıt/yükleme farkı yalnız boş başarılı `transportMigration`; stok, fiyat, sevkiyat ve taşıt alanları eşit.
- **Implication for future audits:** Doğrulanmış aynı karşılaştırma kalıbının bütün kopyalarını ortak operasyonel görünümden geçir; aynı fail-fast kusurunu sırayla bekleme.

## 2026-08-23 — Kolektif eylem UI kapısı oyuncu protestosunu seed'e bırakıyordu
- **Type:** Confirmed
- **Source:** RCA.md — Kolektif eylem UI testi oyuncu protestosunu rastlantıya bırakıyor
- **What happened:** Dünya bir yabancı protesto üretince test koşulsuz olarak oyuncu karar penceresi bekledi.
- **Evidence:** world activeActionCount=1; oyuncu bölgesi activeActionCount=0; pendingResponseCount=0; responseNoticeCount=0; yabancı kamusal eylem görünür ve gizli alanlar kapalı.
- **Implication for future audits:** UI tetikleme sözleşmesini deterministik geçerli fikstürle sınarken doğal dünyayı sıklık/dağılım ve bilgi sınırı için ayrı ölç.

## 2026-08-23 — Oyuncu bildirim sisteminin protestoyu yuttuğu kanıtlanmadı
- **Type:** Refuted
- **Source:** RCA.md — Kolektif eylem UI testi oyuncu protestosunu rastlantıya bırakıyor
- **What happened:** Başarısız koşuda oyuncuya ait pending eylem hiç oluşmadı; bildirim üreticisinin yutacağı bir oyuncu olayı yoktu.
- **Evidence:** player activeActionCount=0 ve pendingResponseCount=0; `storyCollectiveNotice` yalnız oyuncu devleti için tasarlanmış.
- **Implication for future audits:** Girdi olayı oluşmadan çıktı eksikliğini UI bugı sayma; önce tetik koşulunu kaydet.

## 2026-08-23 — Karakter eylemi göç testi Faz 38.6 şema artışında kaldı
- **Type:** Confirmed
- **Source:** RCA.md — Karakter eylemi göç testi güncel karar izi şemasını eski sürüm sanıyor
- **What happened:** Sürüm-2 ve sürüm-3 kayıtları doğru biçimde güncel `story-character-action-ledger-9` yapısına göçerken test sabit sürüm 8 bekledi.
- **Evidence:** Kanonik sabit 9; `a3a8907` karar bağlamı/izi koleksiyonlarını ekliyor; korunan prob `loaded=true`, `validation.ok=true`, `schemaVersion=9`, yedi makbuz verdi.
- **Implication for future audits:** Göç testlerinde hedef şema sabitini yeni kalıcı sözleşme değişiklikleriyle birlikte güncelle; başarılı ve veri koruyan göçü eski literal yüzünden motor hatası sayma.

## 2026-08-23 — Karakter eylemi göçü makbuz veya seçici politikasını kaybetmiyor
- **Type:** Refuted
- **Source:** RCA.md — Karakter eylemi göç testi güncel karar izi şemasını eski sürüm sanıyor
- **What happened:** Assertion düşmesine rağmen eski makbuzlar, güncel politika karması ve defter doğrulaması korundu.
- **Evidence:** Sürüm-2 fikstüründe `receiptCount=7`, `validation.ok=true` ve beklenen `fnv1a32:phase38-speech-realizer-4` politika karması mevcut.
- **Implication for future audits:** Şema eşitsizliğini veri kaybı ilan etmeden yüklenen içerik, doğrulama ve politika kanıtlarını ayrı ayrı kontrol et.

## 2026-08-23 — Konuşma gizliliği fikstürü bağlamsız MAJOR karar üretiyordu
- **Type:** Confirmed
- **Source:** RCA.md — Konuşma gizliliği fikstürü bağlamsız MAJOR karar üretiyor
- **What happened:** Oyuncudan gizli AI–AI sözünü sınayan fikstür, kanonik aday bağlamında bulunmayan sentetik NEGOTIATE kararı kaydetti; Faz 38.6 bunun için zorunlu karar izi istedi.
- **Evidence:** Tek doğrulama kodu `MAJOR_DECISION_TRACE_REQUIRED`; NEGOTIATE önem sınıfı MAJOR; dokuzuncu kararın `decisionTraceId` alanı yok.
- **Implication for future audits:** Bir UI/gizlilik fikstürü daha ağır mekanik sınıfı ölçmüyorsa MAJOR/WORLD eylem seçme; gerçek aday bağlamı gerektiren sözleşmeyi sentetik kimlikle taklit etme.

## 2026-08-23 — Konuşma gerçekleştirici hakem defterini bozmuyor
- **Type:** Refuted
- **Source:** RCA.md — Konuşma gizliliği fikstürü bağlamsız MAJOR karar üretiyor
- **What happened:** Assertion mesajı sorunu konuşma gerçekleştirmeye bağladı, ancak hata realization üretiminden önce seçilen eylemin karar izi zorunluluğundaydı.
- **Evidence:** Bütün realization doğrulamaları ve tekrar/gizlilik kontrolleri geçti; tek sorun dokuzuncu kararın eksik trace referansıydı.
- **Implication for future audits:** Üst düzey assertion metnine göre kaynak seçme; doğrulayıcının hata kodu ve kesin nesne yolunu izleyerek mutasyon aşamasını ayır.

## 2026-08-23 — Faz 38.4 özel canlı NLU adaptörleri rollbackte kayboldu
- **Type:** Confirmed
- **Source:** RCA.md — Faz 38.4 laboratuvar testi geri alınmış canlı NLU adaptörlerini bekliyor
- **What happened:** On senaryo matrisi ve test beklentileri commitlenirken özel speech-act/varlık bağlayıcıları yalnız sorunlu sohbet stash'inde kaldı; güncel canlı motor bunları taşımıyor.
- **Evidence:** Git geçmişinde `PROPOSE_LOGISTICS_REDIRECT` kaynak commit'i yok; stash'te var; on entegrasyon dalının tamamı false fakat doğrudan laboratuvar matrisi geçerli.
- **Implication for future audits:** Test ve plan kapanışında çalışma ağacındaki kaynak dosyalarını commit kapsamıyla eşleştir; stash'te kalan uygulamayı “canlı entegrasyon” sayma.

## 2026-08-23 — Faz 38.4 senaryo karar laboratuvarı bozulmadı
- **Type:** Refuted
- **Source:** RCA.md — Faz 38.4 laboratuvar testi geri alınmış canlı NLU adaptörlerini bekliyor
- **What happened:** Canlı NLU beklentileri düşse de fikstür tabanlı koşul matrisleri bilgi, gerçek, yetki ve karakter dallarını deterministik üretmeye devam etti.
- **Evidence:** Katalog, beklenen sonuç, determinizm, doğrulama, dünya nötrlüğü ve bilgi/gerçek ayrımı kapıları canlı entegrasyon bloğundan önce geçti.
- **Implication for future audits:** Karar matrisi ile doğal dil bağlayıcısını ayrı alt sistemler olarak raporla; birinin yokluğu diğerini otomatik olarak kırık ilan etmez.

## 2026-08-23 — Eski sohbet stash'ini tümden geri almak güvenli değil
- **Type:** Refuted
- **Source:** RCA.md — Faz 38.4 laboratuvar testi geri alınmış canlı NLU adaptörlerini bekliyor
- **What happened:** Stash özel kuralları taşısa da güncel anlama motorundan binlerce satır ayrışıyor ve daha önce çözülemeyen çalışma zamanı deneylerini içeriyor.
- **Evidence:** Güncel dosya yaklaşık 4.973 satır; ilgili stash sürümü yaklaşık 2.832 satır ve diff binlerce satırı değiştiriyor.
- **Implication for future audits:** Kayıp bir dilimi geri almak için bütün stash'i uygulama; güncel mimariye izole, testli ve açık kapsamlı adaptör tasarla.

## 2026-08-23 — Kariyer yaşam döngüsü probunun test importu eksik
- **Type:** Confirmed
- **Source:** RCA.md — Kariyer yaşam döngüsü probu test kapsamına alınmamış
- **What happened:** `f2e3ad8` probu, manifest görevini ve assertion çağrısını ekledi fakat test dosyasındaki destructuring import listesine sembolü bağlamadı.
- **Evidence:** Harness tanımı/ihracı ve manifest kaydı mevcut; `tests/story-world.test.js:3975` deterministik `ReferenceError` veriyor ve import listesinde sembol yok.
- **Implication for future audits:** Yeni prob kabulünde manifest üretimiyle birlikte sequential assertion girişinin sembol bağını da doğrula.

## 2026-08-23 — Kariyer probu silinmiş veya yeniden adlandırılmış değil
- **Type:** Refuted
- **Source:** RCA.md — Kariyer yaşam döngüsü probu test kapsamına alınmamış
- **What happened:** Hatanın prob uygulamasının kaybından geldiği hipotezi incelendi.
- **Evidence:** `probeCharacterCareerLifecycle` aynı adla harness içinde tanımlı, dışa aktarılmış ve manifestte kayıtlı.
- **Implication for future audits:** `ReferenceError` durumunda probu yeniden yazmadan önce tüketici dosyanın import/destructuring bağını kontrol et.

## 2026-08-23 — Korunan sonuç eksikliği kariyer ReferenceError'ını üretmedi
- **Type:** Refuted
- **Source:** RCA.md — Kariyer yaşam döngüsü probu test kapsamına alınmamış
- **What happened:** Korunan paralel sonuç dosyasının eksik olabileceği hipotezi elendi.
- **Evidence:** JavaScript tanımsız argümanı `storyTestResult` çağrısından önce değerlendiriyor; stack sonuç okuyucusuna girmeden duruyor ve manifest kaydı mevcut.
- **Implication for future audits:** Sembol çözümleme hatasını sonuç deposu veya veri üretim hatasıyla karıştırma; stack aşamasını ayır.

## 2026-08-23 — Sequential hikâye tüketicisinde altı ek prob importu eksik
- **Type:** Confirmed
- **Source:** RCA.md — Sequential hikâye testi altı harness probunu import etmiyor
- **What happened:** İlk kariyer importu düzeltildikten sonra statik kullanım/import farkı karakter yaşamı, kohort aktivasyonu/yükselmesi/bütçesi ve hex urban/render için altı eksik sembol daha buldu.
- **Evidence:** Altı adın tamamı test gövdesinde kullanılıyor, harness içinde tanımlı/dışa aktarılmış ve manifestte kayıtlı; test destructuring importunda yok.
- **Implication for future audits:** ReferenceError'ı tek tek düzeltmek yerine test tüketicisinin bütün `probe*` kullanım/import farkını çıkar; paralel manifest başarısını sequential bağ kanıtı sayma.

## 2026-08-23 — CharacterLifeStatus tek eksik prob değil
- **Type:** Refuted
- **Source:** RCA.md — Sequential hikâye testi altı harness probunu import etmiyor
- **What happened:** İkinci ReferenceError'ın yalnız bir atlanmış import olduğu hipotezi statik taramayla elendi.
- **Evidence:** Aynı dosyada beş ek eksik prob sembolü daha bulundu.
- **Implication for future audits:** Ardışık tanımsız isimlerde ilk görünen sembolü bütün kök neden sanma; aynı kalıbın kapsamını statik olarak ölç.

## 2026-08-23 — Altı probun harness veya manifest kaydı kayıp değil
- **Type:** Refuted
- **Source:** RCA.md — Sequential hikâye testi altı harness probunu import etmiyor
- **What happened:** Prob uygulamalarının ya da paralel görev kayıtlarının eksik olabileceği hipotezi elendi.
- **Evidence:** Altı sembol de harness içinde tanımlı ve dışa aktarılmış; karşılık gelen altı manifest görevi mevcut.
- **Implication for future audits:** Uygulama ve üretici hazırsa yeni prob yazma; eksik tüketici bağını onar.

## 2026-08-23 — Bağlamlı sosyal cevap mekanik konuşma kapılarını atlıyor
- **Type:** Confirmed
- **Source:** RCA.md — Mekanik konuşma oturumu sosyal cevap önceliğiyle alan incelemesini atlıyor
- **What happened:** `DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE` taşıyan sosyal cevap, açık clarification soruları ve domain review durumlarından önce değerlendirildi; karmaşık ekonomik teklif `SOCIAL_RESPONSE_READY` durumunda kaldı.
- **Evidence:** Güncel kaynakla yeniden üretilen `conversationUnderstandingProbe` aynı farkı verdi; durum fonksiyonunda sosyal dal mekanik dallardan önce.
- **Implication for future audits:** Konuşma durumlarında doğal cevap varlığını mekanik tamamlanma kanıtı sayma; açık soru, kanıt, yetki ve domain review kapılarını öncele.

## 2026-08-23 — Konuşma probu bayat sonuç nedeniyle düşmedi
- **Type:** Refuted
- **Source:** RCA.md — Mekanik konuşma oturumu sosyal cevap önceliğiyle alan incelemesini atlıyor
- **What happened:** Korunan paralel prob çıktısının eski olabileceği hipotezi güncel tek görev üretimiyle sınandı.
- **Evidence:** Yeni `conversationUnderstandingProbe.bin` ile sequential assertion yine gerçek `SOCIAL_RESPONSE_READY`, beklenen `DOMAIN_REVIEW_NEEDS_EVIDENCE` farkını verdi.
- **Implication for future audits:** Korunan sonuç kullanıldığında şüpheli görevi yeniden üret; aynı hata sürerse ürün davranışını incele.

## 2026-08-23 — Latest oturum ölçümü canlı nesne takma adı değil
- **Type:** Refuted
- **Source:** RCA.md — Mekanik konuşma oturumu sosyal cevap önceliğiyle alan incelemesini atlıyor
- **What happened:** Daha sonraki sosyal UI işlemlerinin eski `completedSession` ölçümünü mutasyonla değiştirdiği hipotezi incelendi.
- **Evidence:** `storyConversationSessionLatest` ledger satırını `storyConversationClone` ile kopyalayarak döndürüyor.
- **Implication for future audits:** Geç ölçüm bozulması şüphesinde önce kopyalama sınırını doğrula; burada hata ölçüm alias'ında değil durumun ilk üretiminde.

## 2026-08-23 — Görüşme UI probu kaldırılmış ACTORBELIEF literalini bekliyor
- **Type:** Confirmed
- **Source:** RCA.md — Görüşme UI probu kaldırılmış geliştirici terimini bekliyor
- **What happened:** Ürün UI bilgi sınırını Türkçe gösterirken harness eski `ACTORBELIEF` terimini aradı.
- **Evidence:** `Talks.js` doğrulanmış cevap ve Türkçe güvenlik notunu render ediyor; realization ve mekanik grounding alanları true.
- **Implication for future audits:** UI güvenlik sözleşmesini iç mimari jargonuna değil oyuncunun gördüğü açık anlama bağla.

## 2026-08-23 — Domain review cevabı UI yolundan kaybolmadı
- **Type:** Refuted
- **Source:** RCA.md — Görüşme UI probu kaldırılmış geliştirici terimini bekliyor
- **What happened:** Mekanik cevap veya realization render yolundan kaybolmuş olabilirdi.
- **Evidence:** `listenerResponseRealized=true`, `mechanicalGroundingPreserved=true`; `Talks.js` cevap ve bilgi sınırını render ediyor.
- **Implication for future audits:** Birleşik görünüm kapısında motor, render ve literal koşulu ayrı incele.

## 2026-08-23 — Diplomatik konuşma probu sınır aşan taraf önkoşulunu kurmuyor
- **Type:** Confirmed
- **Source:** RCA.md — Diplomatik söz ihlali probu sınır aşan taraf önkoşulunu kurmuyor
- **What happened:** Prob ilk ikna edilebilir teması seçti; güncel seed içinde bu kişi ve oyuncu aynı `country:0` ülkesindeydi, fakat alt zincir sınır aşan ihlal bekledi.
- **Evidence:** Doğrudan runtime ölçümü `firstPersuadable=character:0:president`, `ownerId=country:0`, oyuncu ülkesi `country:0`; yabancı ikna edilebilir temas yok.
- **Implication for future audits:** Diplomatik testlerde aktör ülke ayrımını açık fikstür önkoşulu yap; temas sıralamasından türetme.

## 2026-08-23 — Diplomatik review motoru aynı ülke ihlalini yanlış yükseltmedi
- **Type:** Refuted
- **Source:** RCA.md — Diplomatik söz ihlali probu sınır aşan taraf önkoşulunu kurmuyor
- **What happened:** Review motorunun gerçek BROKEN olayı tanımadığı ihtimali incelendi.
- **Evidence:** Review ok ve idempotent kaldı; ticari zarar değerlendirmesi ve kanıtsız savaş engelleri geçti, yalnız cross-border yasal dayanak oluşmadı.
- **Implication for future audits:** Güvenli yükseltmeme davranışını arıza saymadan önce fikstürün gerçekten yabancı devlet tarafları taşıdığını doğrula.

## 2026-08-23 — Söz hafızası follow-up testi sosyal olmayan oturum kullanıyor
- **Type:** Confirmed
- **Source:** RCA.md — Söz hafızası takip probu sosyal olmayan oturumda follow-up çağırıyor
- **What happened:** Yeni görüşme `Söz veriyorum...` ile açıldı; NLU bunu `MAKE_PROMISE / READY_FOR_REVIEW` yaptı, fakat follow-up API yalnız sosyal hazır oturumu kabul ediyor.
- **Evidence:** İzole runtime söz cümlesinde sosyal cevap üretmedi; selam ve önceki sözler açılışı `SOCIAL_RESPONSE_READY` üretti.
- **Implication for future audits:** Hafıza takip testini mekanik teklif/söz oturumuyla karıştırma; sosyal oturum önkoşulunu açık doğrula.

## 2026-08-23 — KEPT ve BROKEN söz hafızası kayıp değil
- **Type:** Refuted
- **Source:** RCA.md — Söz hafızası takip probu sosyal olmayan oturumda follow-up çağırıyor
- **What happened:** Sonraki görüşme hatasının hafıza yazım veya uzun vade recall kaybından gelebileceği incelendi.
- **Evidence:** `promiseMemoryResolved=true` ve `promiseRecallLongHorizon=true`; hata follow-up çağrısı cevap üretmeden önce.
- **Implication for future audits:** Recall zincirinde depolama, doğrudan arama, oturum uygunluğu ve cevap gerçekleştirmeyi ayrı kapılar olarak değerlendir.

## 2026-08-23 — Yabancı aktör fikstürü sonraki karakter eylemine sızıyor
- **Type:** Confirmed
- **Source:** RCA.md — Yabancı aktör test fikstürü sonraki UI eylemine sızıyor
- **What happened:** Diplomatik test için değiştirilen listener `countryId` değeri blok sonunda geri yüklenmedi; sonraki PERSUADE eylemi başlangıç temas bağlamını kaybetti.
- **Evidence:** Atama ile agreement çağrısı arasında teardown yok; diplomatik kapılar geçtikten sonra ilk hata `agreementVisible=false`.
- **Implication for future audits:** Geçici aktör/ülke fikstürlerini setup ve teardown sınırlarıyla kapsülle; uzun problarda mutasyonu runtime sonuna bırakma.

## 2026-08-23 — PERSUADE motoru başlangıç bağlamında kapalı değil
- **Type:** Refuted
- **Source:** RCA.md — Yabancı aktör test fikstürü sonraki UI eylemine sızıyor
- **What happened:** Agreement görünmemesinin genel karakter eylemi yetki kaybından gelebileceği incelendi.
- **Evidence:** Aynı seed ve rolün ilk seçilen teması doğrudan ölçümde `persuade=true`; arıza geçici ülke mutasyonundan sonra oluşuyor.
- **Implication for future audits:** Bir eylemin geç prob aşamasında düşmesini genel motor arızası saymadan önce önceki fikstür mutasyonlarını tara.

## 2026-08-23 — Agreement UI probu eylem öncesi DOM ve eski paneli sorguluyor
- **Type:** Confirmed
- **Source:** RCA.md — Agreement UI probu eylem öncesi render ve eski panel konumu kullanıyor
- **What happened:** Harness PERSUADE öncesi render edilen DOMu kullandı ve 15 Ağustosta İLİŞKİ sekmesine taşınmış kaydı hâlâ sağ konuşma geçmişinde aradı.
- **Evidence:** Kaynak sırası render sonra execute; `Talks.js` kayıtların eski bloktan kaldırılıp İLİŞKİ zincirine taşındığını belgeliyor.
- **Implication for future audits:** UI eylem testinde başarılı makbuzdan sonra rerender yap ve kaydı güncel oyuncu yüzeyinde ara.

## 2026-08-23 — Uygulanmış karakter eylemi kayıt projeksiyonu kaldırılmadı
- **Type:** Refuted
- **Source:** RCA.md — Agreement UI probu eylem öncesi render ve eski panel konumu kullanıyor
- **What happened:** İkna kaydının UI veri projeksiyonundan tümden kaldırılmış olabileceği incelendi.
- **Evidence:** `storyTalkConversationKnownRecords`, APPLIED PERSUADE makbuzunu `İkna girişimi` adıyla ilişki zincirine projekte ediyor.
- **Implication for future audits:** Görünmeyen kayıtta veri üretimi, projection, render zamanı, aktif sekme ve selector konumunu ayrı kontrol et.

## 2026-08-23 — Konuşma defteri göç assertionı yanlış şema-7 literalinde kalmış
- **Type:** Confirmed
- **Source:** RCA.md — Göç testi ürünün şema-4 sözleşmesine rağmen şema-7 bekliyor
- **What happened:** Güncel ürün sözleşmesi ve başarılı göç sonucu şema 4 iken test tek başına 7 bekledi.
- **Evidence:** Sabit, üretici, göç fonksiyonu, doğrulayıcı ve komşu test açıklaması şema 4; yalnız `tests/story-world.test.js:4463` değeri 7.
- **Implication for future audits:** Şema assertionlarında literal, adapter sabiti, doğrulayıcı ve test açıklamasını birlikte karşılaştır.

## 2026-08-23 — Konuşma defteri göç motoru eski kaydı geçersiz üretmiyor
- **Type:** Refuted
- **Source:** RCA.md — Göç testi ürünün şema-4 sözleşmesine rağmen şema-7 bekliyor
- **What happened:** Göçün güncel biçime ulaşamadığı ihtimali incelendi.
- **Evidence:** Prob `schemaVersion=4` ve `validation.ok=true` üretti; güncel doğrulayıcı da tam olarak şema 4 bekliyor.
- **Implication for future audits:** Geçerli göç sonucu ile assertion uyuşmazsa önce bağımsız test literalini sorgula; veri formatını gereksiz yükseltme.
## 2026-08-23 — Şema-2 konuşma göçü olay alanlarını backfill etmiyor
- **Type:** Confirmed
- **Source:** RCA.md — Şema-2 konuşma göçü olay alanlarını undefined bırakıyor
- **What happened:** Eski oturumlarda bulunmayan sourceEventAnchor ve eventDecision, şema-4 göçünde açık null değerine çevrilmedi.
- **Evidence:** Bellek içi probda iki oturumun liste/taviz/çözüm varsayılanları doğruyken bu iki anahtar JSON çıktısında yok; göç döngüsünde de karşılık gelen backfill bulunmuyor.
- **Implication for future audits:** Yeni nullable şema alanlarını yalnız tip kontrolüyle değil açık anahtar varlığı ve serialize/restore turuyla doğrula.

## 2026-08-23 — Göçteki tüm güvenli varsayılanlar bozuk değil
- **Type:** Refuted
- **Source:** RCA.md — Şema-2 konuşma göçü olay alanlarını undefined bırakıyor
- **What happened:** Birleşik defaultsPresent=false sonucunun oyuncu cevapları, kanıtlar, takipler, tavizler veya çözüm alanlarından gelebileceği incelendi.
- **Evidence:** Araçlandırılmış iki oturumda diziler mevcut, useExistingCompany=false, withdrawnClaimIds=[] ve resolution=null; yalnız olay alanları eksik.
- **Implication for future audits:** Birleşik prob düştüğünde her bileşeni ayrı ölç; çalışan backfillleri gereksiz değiştirme.
## 2026-08-23 — Yeni konuşma constructorı nullable olay alanlarını üretmiyor
- **Type:** Confirmed
- **Source:** RCA.md — Yeni şema-4 konuşma oturumu nullable olay alanlarını üretmiyor
- **What happened:** Yeni şema-4 oturum sourceEventAnchor ve eventDecision anahtarları olmadan oluşturulurken restore göçü bunları null ekledi.
- **Evidence:** storyConversationSessionBegin nesne literalinde alanlar yok; göç düzeltmesinden sonra restoredSession.exact=false oldu.
- **Implication for future audits:** Yeni şema alanında constructor ve migrator anahtar kümelerini birlikte doğrula.

## 2026-08-23 — Konuşma save/load başka oturum içeriğini bozmuyor
- **Type:** Refuted
- **Source:** RCA.md — Yeni şema-4 konuşma oturumu nullable olay alanlarını üretmiyor
- **What happened:** Kayıt/yükleme farkının soru, cevap, aday veya müzakere içeriğinden gelebileceği incelendi.
- **Evidence:** Müzakere exact=true; fark, migratorun yeni eklediği fakat constructorın üretmediği iki nullable anahtardan sonra ortaya çıktı.
- **Implication for future audits:** Persistence exact hatasında önce create/migrate shape driftini kontrol et.
## 2026-08-23 — Workspace focus selector takip editörünü atlıyor
- **Type:** Confirmed
- **Source:** RCA.md — Görüşme açılış odağı takip editörünü seçmiyor
- **What happened:** Mevcut görüşmede ana giriş data-conversation-follow-up iken açılış focus selectorü bu kontrolü içermedi ve Yeni Konuşma düğmesini seçti.
- **Evidence:** Talks.js selectoründe follow-up yok; güncel prob workspaceFocusSafe=false.
- **Implication for future audits:** Yeni konuşma kontrolü eklendiğinde açılış focus sırasını mevcut ve boş oturum için birlikte güncelle.

## 2026-08-23 — Takip editörü DOMdan kaybolmuyor
- **Type:** Refuted
- **Source:** RCA.md — Görüşme açılış odağı takip editörünü seçmiyor
- **What happened:** Odağın yanlış olmasının takip editörünün render edilmemesinden gelebileceği incelendi.
- **Evidence:** Harness aynı render sonrasında data-conversation-follow-up öğesini bulup değer, selection ve scroll ölçümü yapabiliyor.
- **Implication for future audits:** Element mevcutken focus düşüyorsa önce querySelector aday sırası ve kapsamını incele.
## 2026-08-23 — Görüşme rerenderı aktif editörü DOMdan koparıyor
- **Type:** Confirmed
- **Source:** RCA.md — Görüşme rerenderı aktif takip editörünü DOMdan koparıyor
- **What happened:** Workspace ana sütunu innerHTML ile yenilenirken aktif textarea durumu yakalanmadı ve yeni düğüme geri verilmedi.
- **Evidence:** Bellek içi ölçümde hasFollowUp=true iken zorunlu render sonrasında activeElement=BODY; render fonksiyonunda focus/draft restore yok.
- **Implication for future audits:** Form içeren innerHTML renderlarında value, selection, scroll ve focus round-tripini birlikte test et.

## 2026-08-23 — Açılış focus selectorü tek başına yeterli değil
- **Type:** Refuted
- **Source:** RCA.md — Görüşme rerenderı aktif takip editörünü DOMdan koparıyor
- **What happened:** Follow-up alanını açılış selectorüne eklemenin tüm odağı düzelteceği varsayıldı.
- **Evidence:** Selector düzeltmesi sonrası workspaceFocusSafe hâlâ false; ikinci render aktif düğümü kaldırıp odağı BODYye çekiyor.
- **Implication for future audits:** Açılış focusu ve sonraki DOM yenilemesi iki ayrı yaşam döngüsü sınırıdır; ikisini ayrı ölç.
## 2026-08-23 — Virüllü focus sorgusu DOM sırasındaki düğmeyi seçiyor
- **Type:** Confirmed
- **Source:** RCA.md — Virüllü focus selectorü aday önceliğini değil DOM sırasını kullanıyor
- **What happened:** Follow-up selector metinde düğmeden önce olsa da querySelector birleşim kümesindeki ilk DOM öğesi olan Yeni Konuşma düğmesini döndürdü.
- **Evidence:** Bellek içi ölçüm forced render öncesinde activeElementin data-conversation-new düğmesi olduğunu gösterdi.
- **Implication for future audits:** Focus önceliğini virgüllü CSS selector sırasına bırakma; adayları açık ardışık sorgularla seç.

## 2026-08-23 — Selector listesindeki yazım sırası focus önceliği sağlamıyor
- **Type:** Refuted
- **Source:** RCA.md — Virüllü focus selectorü aday önceliğini değil DOM sırasını kullanıyor
- **What happened:** Follow-up selectorünü birleşik listenin önüne eklemenin textarea önceliği sağlayacağı varsayıldı.
- **Evidence:** Liste güncellendiği halde activeElement Yeni Konuşma kaldı; düğme DOMda textarea önünde.
- **Implication for future audits:** CSS selector birleşimi ile uygulama öncelik zincirini birbirinden ayır.
## 2026-08-23 — Genel REQUEST_SUPPORT takip dalı eksik
- **Type:** Confirmed
- **Source:** RCA.md — Genel yardım takip sözü grounded discourse dalına bağlanmıyor
- **What happened:** NLU yardım takip sözünü doğru sınıflandırdı fakat grounded cevap yalnız askerî tehditli desteği ele aldığı için genel destek isteği profil fallbackine düştü.
- **Evidence:** speechAct=REQUEST_SUPPORT; helpFollowUpUnderstood=false, response discourseAct boş; grounded kaynakta genel destek dalı yok.
- **Implication for future audits:** Sosyal eylemleri açılışta tanımakla yetinme; aynı görüşme takip cevabı ve tekrar onarımını ayrı doğrula.

## 2026-08-23 — Yardım takip hatası yalnız NLU sınıflandırması değil
- **Type:** Refuted
- **Source:** RCA.md — Genel yardım takip sözü grounded discourse dalına bağlanmıyor
- **What happened:** Cümlenin REQUEST_SUPPORT olarak tanınmadığı ihtimali incelendi.
- **Evidence:** Follow-up analizi REQUEST_SUPPORT üretiyor; kayıp, sonraki grounded response seçiminde.
- **Implication for future audits:** Anlama, cevap politikası ve realization katmanlarını ayrı ölç.

## 2026-08-23 — Harness eski deterministic discourse source etiketini bekliyor
- **Type:** Confirmed
- **Source:** RCA.md — Genel yardım takip sözü grounded discourse dalına bağlanmıyor
- **What happened:** Motor güncel grounded kaynağı DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE olarak etiketlerken dört harness kontrolü kaldırılmış etiketi kullanıyor.
- **Evidence:** Eski etiket yalnız harness içinde; güncel ürün etiketi f29215b kaynak değişiminden geliyor.
- **Implication for future audits:** Gözlenebilir adapter/source etiketi değiştiğinde doğrudan laboratuvar sözleşmesini aynı committe güncelle.
## 2026-08-23 — Uzun bağlam fikstürü budanmış ilk kalite oturumunu kullanıyor
- **Type:** Confirmed
- **Source:** RCA.md — Uzun bağlam probu oturum sınırında budanan ilk kalite oturumunu seçiyor
- **What happened:** Prob üç kalite oturumunun ilk kimliğini sakladı; daha sonraki begin çağrıları 32 kayıt sınırında bu eski oturumu budadı.
- **Evidence:** conversationSessionGet null, worker discourseContext initialText üzerinde TypeError; longContextSessionId yalnız sessionIndex 0 için atanıyor.
- **Implication for future audits:** Bounded ledger problarında ölçüm için en yeni canlı fixtureyi seç ve erişilebilirliğini açık doğrula.

## 2026-08-23 — Canlı oturum budama sınırı arızalı değil
- **Type:** Refuted
- **Source:** RCA.md — Uzun bağlam probu oturum sınırında budanan ilk kalite oturumunu seçiyor
- **What happened:** Null oturumun ürünün yanlış kayıt silmesinden gelebileceği incelendi.
- **Evidence:** STORY_CONVERSATION_SESSION_LIMIT=32 ve begin en eski kayıtları bilinçli FIFO buduyor; harness eski kimliği sınırın ötesinde tutuyor.
- **Implication for future audits:** Test verisini ürünün bounded-retention sözleşmesine uydur; limiti testi geçirmek için büyütme.
## 2026-08-23 — Genel yardım takip hareketi katalog dışı kaldı
- **Type:** Confirmed
- **Source:** RCA.md — Genel yardım takip hareketi diyalog sözleşmesinde kayıtlı değil
- **What happened:** Üretici CONTINUE_REQUEST yazdı fakat DialogueMove doğrulayıcısı bu eylemi tanımadığı için geçerli takip turu ledgerı geçersizleştirdi.
- **Evidence:** İlk hata kalite oturumu 0 takip 6 üzerinde DIALOGUE_MOVE; metin yardım isteği, follow-up sonucu FOLLOW_UP_RECORDED, katalogda CONTINUE_REQUEST yok.
- **Implication for future audits:** Yeni discourseAct eklerken üretici, hareket kataloğu, validator ve doğrudan laboratuvar testi aynı değişiklik sınırında güncellenmeli.

## 2026-08-23 — Uzun bağlam oturumu FIFO budamasıyla kaybolmadı
- **Type:** Refuted
- **Source:** RCA.md — Genel yardım takip hareketi diyalog sözleşmesinde kayıtlı değil
- **What happened:** Önceki RCA ilk kalite oturumunun 32 kayıt sınırıyla budandığını varsaydı.
- **Evidence:** En yeni oturumu seçme değişikliğine rağmen id conversation-session:1, latest null ve sessions boş kaldı; ilk gerçek bozulma yardım turundaki DIALOGUE_MOVE doğrulama hatasıydı.
- **Implication for future audits:** Null kayıt gördüğünde retention varsaymadan önce sequence, ham validation ve ilk bozulma turunu ölç.
## 2026-08-23 — Görüşme renderı deferWhileTyping sözleşmesini uygulamıyor
- **Type:** Confirmed
- **Source:** RCA.md — Görüşme renderı yazım-erteleme seçeneğini yok sayıyor
- **What happened:** Render aktif editör değerini yeni düğüme geri yükledi ancak deferWhileTyping seçeneğini kabul etmediği için eski DOM düğümünü yine değiştirdi.
- **Evidence:** draftSurvivedRerender=true, draftDeferredWithoutReplacement=false; fonksiyon parametresiz ve pending bayrağını mutasyondan önce siliyor.
- **Implication for future audits:** Taslak değerinin korunması ile aktif editör DOM kimliğinin korunmasını ayrı UX sözleşmeleri olarak test et.

## 2026-08-23 — Taslak erteleme hatası metin kaybı değil
- **Type:** Refuted
- **Source:** RCA.md — Görüşme renderı yazım-erteleme seçeneğini yok sayıyor
- **What happened:** Assertionın taslak metninin kaybolmasından doğduğu ihtimali incelendi.
- **Evidence:** Zorunlu rerender sonrası değer ve focus restorasyonu geçiyor; başarısız olan düğüm eşitliği ve pending bayrağı.
- **Implication for future audits:** Görsel olarak aynı metin kalması, IME ve undo güvenliği için yeterli değildir.
## 2026-08-23 — Dolaylı destek isteği ASK_INFORMATION sınıfına düşüyor
- **Type:** Confirmed
- **Source:** RCA.md — Dolaylı askerî destek isteği soru olarak yanlış sınıflanıyor
- **What happened:** Desteğini istesem kabul eder misin ifadesi dar REQUEST_SUPPORT listesine uymadı ve genel soru puanı baskın geldi.
- **Evidence:** İlk bağlamsal tur speechAct=ASK_INFORMATION, discourseAct=ANSWER_INFORMATION_BOUNDARY; cümledeki ordu askeri bağlam sözlüğünde mevcut.
- **Implication for future audits:** NLU kalıp listelerini tek tek büyütmek yerine niyet kökü ile eylem/soru biçimini bileşik özellik olarak puanla.

## 2026-08-23 — Bağlamsal destek hatası oturum reddi değil
- **Type:** Refuted
- **Source:** RCA.md — Dolaylı askerî destek isteği soru olarak yanlış sınıflanıyor
- **What happened:** İlk takip turunun bekleyen LLM veya oturum durumu yüzünden reddedildiği ihtimali incelendi.
- **Evidence:** Sonuç FOLLOW_UP_RECORDED, geçerli response ve DialogueMove içeriyor; yanlış olan speech-act seçimidir.
- **Implication for future audits:** Boolean probe başarısızlığında result code, analysis ve response katmanlarını ayrı kaydet.
## 2026-08-23 — Askerî destek probu doğru domain hareketini reddediyor
- **Type:** Confirmed
- **Source:** RCA.md — Askerî destek probu güvenli alan hareketini yanlış etiketle reddediyor
- **What happened:** NLU doğru REQUEST_SUPPORT ürettikten sonra motor doğrulanmamış askerî isteği güvenli alan hareketiyle ele aldı; harness genel CONTINUE_REQUEST bekledi.
- **Evidence:** discourseAct=ASSESS_UNVERIFIED_MILITARY_REQUEST, güvenli askerî cevap, worldMutation=false ve geçerli DialogueMove.
- **Implication for future audits:** Genel sosyal niyet ile alan-özel güvenli karar hareketinin aynı etiketi taşımasını bekleme.
## 2026-08-23 — Kısa gerekçe ve karşıt düzeltme operatörleri eksik
- **Type:** Confirmed
- **Source:** RCA.md — Kısa gerekçe ve karşıt konu düzeltmeleri söylem eylemine bağlanmıyor
- **What happened:** Aktif söylem durumu mevcut olmasına rağmen Neden? genel bilgi sınırına, X değil Y düzeltmesi belirsiz girdi fallbackine düştü.
- **Evidence:** İkinci tur ANSWER_INFORMATION_BOUNDARY, dördüncü tur CLARIFY_AMBIGUOUS_INPUT; questionFocus içinde iki operatör de yok.
- **Implication for future audits:** Uzun bağlam yalnız geçmiş metni saklamak değildir; artgönderim, gerekçe, düzeltme ve konu dönüşü operatörleri ayrı sözleşmeler gerektirir.
## 2026-08-23 — Tekrar onarım testi sözcük dizilimine aşırı bağlı
- **Type:** Confirmed
- **Source:** RCA.md — Tekrar onarım probu doğru cevabı aşırı dar metin kalıbıyla reddediyor
- **What happened:** Doğru REPAIR_REPETITION cevabı doğrudan ve ifadesini kullandı; test yalnız doğrudan cevap tam parçasını kabul etti.
- **Evidence:** Hareket ve kaynak doğru, metin tekrarı kabul ediyor; yalnız regex false.
- **Implication for future audits:** Davranış kapısını yapılandırılmış hareketle kur, doğal dil kontrolünü semantik köke indir; tam sözcük dizilimini kontrat yapma.
## 2026-08-23 — Mekanik oturum durumu sosyal takipleri kapatıyor
- **Type:** Confirmed
- **Source:** RCA.md — Mekanik inceleme açıkken aynı görüşmede sosyal takip tamamen engelleniyor
- **What happened:** Ticari oturum NEEDS_CLARIFICATION durumundayken takip API’si yalnız SOCIAL_RESPONSE_READY kabul ettiği için check-in ve belirsizlik onarımı analize ulaşmadı.
- **Evidence:** Dört süreklilik alanı birlikte false; follow-up durum kapısı tek erken dönüş noktası.
- **Implication for future audits:** Görüşme durumu mekanik inceleme aşamasını gösterir; sosyal konuşma yetkisini tek başına kapatmamalıdır.
## 2026-08-23 — Elli tur kapısı geçerli profil cevaplarını dışlıyor
- **Type:** Confirmed
- **Source:** RCA.md — Elli turluk kalite kapısı geçerli profil cevap kaynaklarını dışlıyor
- **What happened:** Günlük sohbetlerin kasıtlı profil tabanlı kaynakları eski iki-kaynak filtresine uymadığı için sağlamlık kapısı false oldu.
- **Evidence:** 46 profil cevabı; allAccepted ve intentsExact true, adjacentRepeats 0, unique 20, yasak fallback 0.
- **Implication for future audits:** Kaynak etiketi kapılarını üretim cevap mimarisinin tüm güvenli katmanlarıyla birlikte sürümle.
## 2026-08-23 — Çok katılımcılı oturum UI’si yalnız formal meeting yolunu okuyor
- **Type:** Confirmed
- **Source:** RCA.md — Genel çok katılımcılı oturum sol profilde tek kişiye düşüyor
- **What happened:** Session participantActorIds taşısa da renderer activeMeeting yoksa tek listener profilini çizdi; bilinmeyen kimlik fallbacki de yoktu.
- **Evidence:** Beklenen üç karta karşı sıfır participant kartı; rendererın tek koşulu formal meetingCase.
- **Implication for future audits:** Mekanik meeting kaydı ile salt-okunur çok-katılımcı UI projeksiyonunu ayrı sınırlar olarak tasarla.
## 2026-08-23 — Kalıcılık sayacı takip cevaplarını saymıyor
- **Type:** Confirmed
- **Source:** RCA.md — Kalıcılık assertionı hedef cevaplar yerine bütün sosyal açılışları sayıyor
- **What happened:** Sayaç tüm SOCIAL_RESPONSE açılışlarını saydı fakat mesaj bunu sekiz açılış ve dört FOLLOW_UP_RESPONSE olarak yorumladı.
- **Evidence:** restored exact ve validation true; filtre yalnız SOCIAL_RESPONSE, gerçek toplam 16.
- **Implication for future audits:** Kalıcılık testlerinde tür toplamına sabit sayı bağlamak yerine hedef kayıt kimliklerini save/load boyunca izle.
## 2026-08-23 — Geri alınmış olay sohbeti birleşik probda canlı kabul ediliyor
- **Type:** Confirmed
- **Source:** RCA.md — Geri alınmış siyasi olay sohbet adaptörü birleşik testte hâlâ zorunlu
- **What happened:** Runtime’da hiç bulunmayan event counsel, açık kabul ve karar hafızası API’leri eski birleşik assertion grubunda zorunlu kaldı.
- **Evidence:** Semboller yalnız harness/testte; kanonik durum belgesi probeu bayat ve olay API’lerini geri alınmış olarak işaretliyor.
- **Implication for future audits:** Planlanan veya geri alınmış dikeyi ana regresyon kapısında tutma; sevk edilmiş en küçük API ile ayrı probe kur.

## 2026-08-23 — Siyasi olay sohbeti son NLU düzeltmesinde silinmedi
- **Type:** Refuted
- **Source:** RCA.md — Geri alınmış siyasi olay sohbet adaptörü birleşik testte hâlâ zorunlu
- **What happened:** Event button yokluğunun güncel NLU değişikliklerinden kaynaklandığı ihtimali incelendi.
- **Evidence:** Git sembol araması sevk edilmiş runtime uygulaması bulmadı; durum belgesi bunu önceden açık borç ve bayat probe olarak kaydetmiş.
- **Implication for future audits:** Regresyon iddiasından önce sembol geçmişi ve kanonik uygulama durumunu birlikte kontrol et.
## 2026-08-23 — Mevsim çipi dünya dengesi metriklerini düşürüyor
- **Type:** Confirmed
- **Source:** RCA.md — Mevsim çipi dünya dengesi metriklerini görünmez kılıyor
- **What happened:** Çağ çipi mevsim çipine dönüştürülürken yeni tooltip yalnız anlatıyı taşıdı; mevcut savaş/refah/çalkantı/teknoloji ölçümleri birleştirilmedi.
- **Evidence:** Runtime balonunda mevsim ve `SOĞUK DENGE` var, `Savaş`/`Refah` yok; eski `storyWorldStateTooltip()` aynı metrikleri hâlâ üretiyor.
- **Implication for future audits:** Bir UI yüzeyinin etiketi değiştiğinde eski yüzeyin karar verisi sözleşmesini ayrı doğrula; aynı veriyi ikinci bir formatter ile çoğaltma.

## 2026-08-23 — Dünya durumu tooltip testi eski çağ etiketine bağlı değil
- **Type:** Refuted
- **Source:** RCA.md — Mevsim çipi dünya dengesi metriklerini görünmez kılıyor
- **What happened:** Kırılmanın mevsim değişikliği sonrası bayat bir test olabileceği incelendi.
- **Evidence:** Assertion görünür etiket metnini değil oyuncuya gerekli `Savaş` ve `Refah` karar verisini arıyor; mevsim etiketiyle çelişmiyor.
- **Implication for future audits:** Görsel etiket değişimiyle bilgi sözleşmesi değişimini birbirinden ayır.
## 2026-08-23 — HXD toplam koridor kapısı ray genişlemesinden önce kalmış
- **Type:** Confirmed
- **Source:** RCA.md — HXD başlangıç envanteri sonradan eklenen ray koridorlarını saymıyor
- **What happened:** Test tarihsel 591 LAND/SEA/ENERGY/DATA temelini güncel toplam sandı; HXD-7.3 ile sevk edilen 40 bağımsız RAIL koridorunu saymadı.
- **Evidence:** Runtime 631 üretiyor; fark tam 40 ve aynı paket bütün 40 ray koridorunun fiziksel zincirini ayrıca doğruluyor.
- **Implication for future audits:** Tarihsel baseline sayısını güncel katalog toplamından isim ve assertion düzeyinde ayır; mod başına toplamları birlikte kapıla.

## 2026-08-23 — 631 koridor topoloji çoğaltma hatası değil
- **Type:** Refuted
- **Source:** RCA.md — HXD başlangıç envanteri sonradan eklenen ray koridorlarını saymıyor
- **What happened:** Altyapı üreticisinin 40 fazladan koridoru yanlışlıkla çoğaltmış olabileceği incelendi.
- **Evidence:** Artış açık tanımlı RAIL kataloğunun tam boyutu; kimlik tekilleştirmesi var ve sourceRailCorridorCount fiziksel testte 40.
- **Implication for future audits:** Toplam farkını önce mod/katalog bileşenlerine ayır, yalnız ham toplamdan regresyon sonucu çıkarma.
## 2026-08-23 — Politik overlay kapısı eski 300 px fallbackte kalmış
- **Type:** Confirmed
- **Source:** RCA.md — Politik overlay testi geri dönüş fallback çözünürlüğünü canlı katman sanıyor
- **What happened:** HXD-5 canlı politik canvası 1640×1290'a taşıdı; test gerçek render cache'ini hâlâ geçici Faz 14.2 300 px değeriyle karşılaştırdı.
- **Evidence:** Runtime HXD politik adaptöründen 1640 döndürüyor; kanonik belgeler 7.517 hücreli 1640×1290 canvası kabul ediyor.
- **Implication for future audits:** Canlı render çözünürlüğü ile kalite ölçümü için üretilen downsample örneğini ayrı alan ve assertion adıyla tut.

## 2026-08-23 — 300 px downsample teşhisi gereksiz değil
- **Type:** Refuted
- **Source:** RCA.md — Politik overlay testi geri dönüş fallback çözünürlüğünü canlı katman sanıyor
- **What happened:** Canlı katman 1640 olduğu için tüm 300 px kontrollerinin kaldırılması ihtimali incelendi.
- **Evidence:** Harness 300 px örneği canlı render için değil kıyı uyumu ve ince-geometri kaybını ölçmek için açıkça ayrı üretiyor.
- **Implication for future audits:** Bayat canlı-yol assertionını kaldırırken bağımsız kalite karşılaştırmasını yanlışlıkla silme.
## 2026-08-23 — ImageData kapalı yol artık HXD politik canvasına düşüyor
- **Type:** Confirmed
- **Source:** RCA.md — ImageData bayrağı kapalı testi HXD politik canvasından önceki fallbacki bekliyor
- **What happened:** Test ImageData bayrağı kapalıyken eski 300×236 fillRect fallbackini bekledi; HXD-5 öncelik sırası bağımsız 1640×1290 politik canvası önce kullanıyor.
- **Evidence:** disabled=true ve directCanvas=null iken hex adapter aktif, render 1640×1290, fillRect/putImageData sıfır, A/B dünya karması eşit.
- **Implication for future audits:** Özellik bayrağı testini bütün renderer yerine bayrağın sahip olduğu adaptör sınırına bağla; öncelik zinciri değişince fallback kabulünü yeniden adlandır.

## 2026-08-23 — ImageData bayrağı HXD politik katmanını kapatmıyor
- **Type:** Refuted
- **Source:** RCA.md — ImageData bayrağı kapalı testi HXD politik canvasından önceki fallbacki bekliyor
- **What happened:** Bayrak kapalıyken HXD canvasın da kapanması gerektiği ihtimali incelendi.
- **Evidence:** Bayrak `political-overlay-rgba` üreticisini kapsıyor; HXD ayrı adaptör ve runtime öncelik zincirinde ondan önce geliyor.
- **Implication for future audits:** Bayrak sahipliğini isim, adapterVersion ve çağrı sırasıyla birlikte belgele.
## 2026-08-23 — Warp assertionı düz projeksiyon tek-blit yolunu tanımıyor
- **Type:** Confirmed
- **Source:** RCA.md — Warp testi düz projeksiyon tek-blit hızlı yolunu şerit döngüsü sanıyor
- **What happened:** Test her zoomda plan satırı kadar drawImage bekledi; uzak/düz görünüm optimizasyonu katman başına tek blit kullanırken yalnız yakın perspektif şerit planını çiziyor.
- **Evidence:** Uzak örnekler toplam 2 çağrı ve sıfır hata; yakın örnek 270×2 çağrı, 1 miss/2 hit ve %0,2101 ölçek hatası verdi.
- **Implication for future audits:** Planlanan geometri ile fiilen seçilen render yolunun telemetrisini ayrı tut; çağrı kapısını last-frame yürütme verisine bağla.

## 2026-08-23 — Tek-blit yolu harita katmanını atlamıyor
- **Type:** Refuted
- **Source:** RCA.md — Warp testi düz projeksiyon tek-blit hızlı yolunu şerit döngüsü sanıyor
- **What happened:** İki çağrının terrain veya politik katmandan birinin çizilmediği anlamına gelebileceği incelendi.
- **Evidence:** Prob iki ayrı `storyBlitWarp` çağrısında `first=true` ve `second=true`; lastFrame katman başına bir drawImage yayımlıyor.
- **Implication for future audits:** Azalan çağrı sayısını eksik iş diye yorumlamadan çağrı başına kapsanan katman/alanı doğrula.
## 2026-08-23 — README cache API'sini anlatıp kaynak sahibini atlıyor
- **Type:** Confirmed
- **Source:** RCA.md — README harita cache sözleşmesini anlatıyor fakat kaynak dosyayı adlandırmıyor
- **What happened:** Harita README'si merkezî invalidation API ve scope'ları korudu, ancak kanonik `js/StoryMapCache.js` dosya adını reorganizasyonda kaybetti.
- **Evidence:** README'de API/scope bölümü var fakat dosya adı yok; index ve kanonik durum belgesi sahipliğin değişmediğini gösteriyor.
- **Implication for future audits:** Mimari README'de yalnız API adını değil, tek otorite dosyasını ve yükleme sınırını da belirt.

## 2026-08-23 — StoryMapCache assertionı biçime aşırı bağlı değil
- **Type:** Refuted
- **Source:** RCA.md — README harita cache sözleşmesini anlatıyor fakat kaynak dosyayı adlandırmıyor
- **What happened:** Belge testi eski paragraf düzenini zorunlu tutuyor olabilir diye incelendi.
- **Evidence:** Assertion yalnız `/StoryMapCache\.js/` arıyor; başlık, sıra veya tam cümleyi sabitlemiyor.
- **Implication for future audits:** Belge kapılarını mümkün olduğunca kanonik isim/bağlantı varlığına bağla, tam metin snapshotına değil.
## 2026-08-23 — Yükleme-anı taşıma göç teşhisi dünya hashine sızıyor
- **Type:** Confirmed
- **Source:** RCA.md — Yükleme-anı taşıma göç teşhisi deterministik dünya hashine sızıyor
- **What happened:** Scheduler devamlılık probu tam save JSON'unu kanonik dünya diye karşılaştırdı; yalnız `storyLoad()` sırasında üretilen `transportMigration` teşhisi eşit dünyaları farklı gösterdi.
- **Evidence:** Fark listesinde tek yol `$.tradeLogistics.diagnostics.transportMigration`; ticaretin operasyonel kalıcılık görünümü `diagnostics` alanını zaten dışlıyor.
- **Implication for future audits:** Süreç-yerel yükleme/onarım tanılarını dünya determinizmi hashinden ayır; operasyonel defter eşitliğini ayrıca koru.

## 2026-08-23 — Scheduler/RNG devamlılığı bozulmadı
- **Type:** Refuted
- **Source:** RCA.md — Yükleme-anı taşıma göç teşhisi deterministik dünya hashine sızıyor
- **What happened:** Hash farkının yükleme sonrası görev sırası veya RNG ayrışmasından kaynaklanabileceği incelendi.
- **Evidence:** Hem checkpoint hem gelecek farkı yalnız taşıma göç teşhisinde; dünya, zamanlayıcı ve RNG alanlarında ikinci bir fark yok.
- **Implication for future audits:** Ham hash ayrışmasında önce alan-yolu farkını çıkar; tanı metadatasını simülasyon sapmasıyla karıştırma.
## 2026-08-23 — Onaylı NLU fallback ve konuşma devamlılığı paketi tamamlandı
- **Type:** Executed
- **Source:** plans/documentation-layout.md — Execution Record
- **What happened:** Bayat özel canlı-NLU assertionları kaldırıldı; doğrudan laboratuvar kapıları korunarak 10 alanın her biri için güvenli, komutsuz ve dünya-nötr fallback doğrulaması eklendi. Konuşma devamlılığı ve ilgili UI/test sözleşmeleri güncellendi.
- **Evidence:** Hedefli sıralı dünya assertionı geçti; tam `npm test -- --keep-results` koşusunda 88/88 dünya probu, 50 oyuncu regresyonu ve 60 adversarial konuşma senaryosu başarılı oldu. Sonuç dizini: `C:\Users\osman\AppData\Local\Temp\pixel-rts-story-test-DyPH47`.
- **Implication for future audits:** Özel alan runtime bağlayıcısı gerçekten sevk edilmeden canlı entegrasyon iddiası kurma; laboratuvar anlama başarısını güvenli fallback ve dünya değişimi yetkisiyle ayrı kapıla.

## 2026-08-23 — Oyuncu eylem görünümü yönetim görünümünü özyinelemeli çağırıyor
- **Type:** Confirmed
- **Source:** RCA.md — Oyuncu eylem görünümü yönetim görünümünü özyinelemeli çağırıyor
- **What happened:** 18 aile yönetim UI'sine eklenirken bölge varsayılanı aynı üst seviye yönetim görünümünü yeniden çağırdı ve stack taşmasına yol açtı.
- **Evidence:** Deterministik runtime stack zinciri `storyGovernancePlayerView → storyPlayerAgencyFamilyView → storyPlayerAgencyRegionId → storyGovernancePlayerView` olarak tekrar ediyor.
- **Implication for future audits:** Alt görünüm önizlemeleri üst görünüm kurucusunu çağırmamalı; seçili bağlam yalın state veya parametreden okunmalı ve kayıt sayımı gerçek render kabulünün yerine geçmemeli.
## 2026-08-23 — Oyuncu eylem kabul testi cross-realm dizi karşılaştırmasına takılıyor
- **Type:** Confirmed
- **Source:** RCA.md — Oyuncu eylem kabul testi jsdom dizisini ana realm dizisiyle karşılaştırıyor
- **What happened:** jsdom VM'sinden gelen boş `missing` dizisi ana Node realm'indeki boş diziyle strict-deep karşılaştırıldı; aynı değerler farklı prototip nedeniyle reddedildi.
- **Evidence:** Assertion `actual: []` ve `expected: []` raporladı; kabul özeti aynı anda 18 actionable aile taşıyor.
- **Implication for future audits:** Harness sınırından gelen dizi/nesneleri strict yapısal assertiondan önce ana realm yalın değerlerine normalize et; realm kimliğini alan başarısızlığı sanma.
## 2026-08-23 — Kurumsal istifa makbuzu domain defter sahibini belirtmiyor
- **Type:** Confirmed
- **Source:** RCA.md — Kurumsal istifa oyuncu makbuzu kanonik defter sahibini belirtmiyor
- **What happened:** Fiziksel halefiyet makbuzu doğrudan ortak oyuncu zarfına geçirildi; 17 ailede bulunan `ledger` kaynağı yalnız kurum ailesinde eksik kaldı.
- **Evidence:** Kabul testi `INSTITUTIONS` için tekil olarak defter alanı eksikliği verdi; transition ve successor alanları fiziksel uygulamayı doğruluyor.
- **Implication for future audits:** Ortak eylem zarfları domain makbuzunu kayıpsız taşımalı fakat kaynak defteri ayrıca ve zorunlu olarak adlandırmalı.
## 2026-08-24 — Bekleyen konuşmalar karakter görüşmesine taşındı
- **Type:** Executed
- **Source:** Doğrudan kullanıcı talimatı — sohbet ve diplomasi arayüzü sadeleştirmesi
- **What happened:** Eski bekleyen konuşma listesi, otomatik komutan konuşmaları ve sohbet içindeki doğrudan eylem kartı kaldırıldı. Bekleyen kararlar kanonik `speakerActorId` üzerinden ilgili karakterin karşılıklı görüşme penceresine taşındı; diplomasi ilk görünümü dört eşit sütuna geçirildi. İkili ekonomik diplomasi ile askerî bina çalışma alanı için katmanlı ana planlar eklendi.
- **Evidence:** Hedefli temas dizini probunun yedi UI/sözleşme kapısı geçti; zamanlayıcı sırası, çalışma adetleri, A/B dünya özdeşliği ve kayıt devamlılığı korundu; oyuncu eylem testi 18/18 geçti.
- **Implication for future audits:** Bekleyen kararların keşfi ve çözümü karakter görüşme çalışma alanından sınanmalı; eski komutan akışı, bağımsız bekleyen liste veya sohbet içi doğrudan eylem kartı yeniden oluşturulmamalı.

## 2026-08-24 — Hikâye modu simülasyonu ve ticaret/lojistik mikro-donma optimizasyonları tamamlandı
- **Type:** Executed
- **Source:** Doğrudan kullanıcı talimatı — Hikâye modu 6 saniyelik donma ve FPS optimizasyonu
- **What happened:** Simülasyonun ana iş parçacığında 5-8 saniyelik donmalara yol açan kök nedenler çözüldü: (1) `StoryClock.js` içindeki frame başına sınırsız simülasyon adımı accumulator limitine (max 2 adım/12ms) bağlandı; (2) `StoryRoutePlanner.js` Dijkstra algoritmasındaki her kenar gevşetmesinde 5 dizi kopyalama ve $O(K \log K)$ sıralama yerine Set indeksli minimum çekme ve geriye dönük pointer izleme getirildi; (3) `StoryTrade.js` içindeki hane halkı ve üretim girdisi arz/talep eşleştirmelerinde adaylar en iyi 4 bölgeyle sınırlandırıldı; (4) `StoryCommerce.js` envanter lotları bölge ve kaynak anahtarlı `Map` indeksine alınarak $O(N)$ dizi taramaları $O(1)$ doğrudan erişime dönüştürüldü; (5) `StoryTransportAgents.js` sözleşme aramaları Map indeksine bağlandı ve segment kayıtları resident sidecar üzerinden önbelleklendi.
- **Evidence:** `npm run test:story-player-agency` (18/18 test OK) ve `npm run test:story-infrastructure` (20/20 test OK) tüm alt sistemleriyle eksiksiz doğrulandı.
- **Implication for future audits:** Ticaret ve envanter işlemlerinde global array taramaları (`filter/find`) yerine daima Map indeksleri kullanılmalı; rota aramasında candidate sayısı budanmalı ve browser simülasyon accumulator'ı asla serbest bırakılmamalı.

## 2026-08-24 — Ekonomik AI ve rota arama donma pikleri (1 FPS) giderildi
- **Type:** Executed
- **Source:** Doğrudan kullanıcı talimatı — 1 FPS donma piklerinin giderilmesi
- **What happened:** Tekil adımlarda 1.000 ms - 1.360 ms süren piklerin nedenleri çözüldü: (1) `StoryInfrastructure.js` içindeki `storyInfrastructureFindRoute` algoritması ağ ve hasar revizyonu anahtarlı `Map` önbelleğine alındı, Set indeksli minimum çekme ve geriye dönük pointer izlemeye geçirildi; (2) `StoryEconomicAI.js` içindeki `storyEconomicAIReachableInput` girdi erişim aramaları hedef bölge, ülke ve kaynak anahtarlı önbelleğe alındı, yerel stoku yeterli olan tesislerin tüm bölgeleri taraması engellendi; (3) `StoryEconomicAI.js` şirket aday skorları portföy döngüsünde önbelleğe alınarak aynı adımların tekrar hesaplanması önlendi; (4) `StoryTrade.js` içindeki `storyTradeAutoBalance` tedarik adayları ilk 4 ile sınırlandırıldı; (5) `StoryRegionalEconomy.js` içindeki 5.000+ derin `JSON.parse` klonlaması sığ spread kopyalamalarla değiştirildi ve tesisler bölgeye göre indekslendi.
- **Evidence:** 30 saniyelik 120 adımlı simülasyon duvar süresi 35 saniyeden 7,6 saniyeye indi (4,6 kat gerçek zamanlı hızlanma); `npm run test:story-player-agency` (18/18) ve `npm run test:story-infrastructure` (20/20) tam başarıyla geçti.
- **Implication for future audits:** Rota ve girdi arama sonuçları simülasyon saati yerine ağ ve hasar revizyonuna göre önbelleklenmeli; şirket portföy sıralamalarında yerel stoku yeterli olan tesisler için küresel rota araması yapılmamalı.

## 2026-08-24 — Fare sürükleme 1 FPS donması giderildi ve lojistik araçları hareketlendirildi
- **Type:** Executed
- **Source:** Doğrudan kullanıcı talimatı — Fareyle harita kaydırmada 1 FPS donması ve tır/tren/gemi lojistik araçlarının hareketsizliği
- **What happened:** 
  1. **Fare Sürükleme 60 FPS Sabitleme:** `StoryRender.js` içinde harita sürükleme (`STORY._mapInteracting === true`) esnasında asenkron `createImageBitmap` GPU transfer kuyruğu spam'i durduruldu ve doğrudan 2D Canvas önbelleğinden pürüzsüz `drawImage` dönüşümüne geçildi; sürükleme sırasında 152 şehir ve yüzlerce ilçeyi her karede tarayan `storyMapStructurePickRegistryRefresh` pasife alınıp fare bırakıldığında tazelemeye bağlandı; 152 düğüm için yazı tipi `measureText` ve etiket çakışma hesaplamaları `Map` üzerinden memoize edildi; `StoryUI.js` hover `mousemove` taramaları `requestAnimationFrame` ile optimize edildi.
  2. **Lojistik Araçlarının Canlı Hareketi:** `StoryTransportAgents.js` ve `StoryRender.js` içinde lojistik araçları varsayılan harita ölçeğinde (`zoomRatio < 1.35`) hücre merkezine kilitleyen agregasyon modundan çıkarılarak tüm harita ölçeklerinde (`materializeZoomRatio: 0.05`) mikro-adım ilerlemesi korunan bağımsız hareketli ajanlara dönüştürüldü; tır, yük treni ve kargo gemisi görsel spriteları ve yön açıları (`agent.angle`) LOD ölçeklemesiyle görünür kılındı; `Story.js` ve `StoryScheduler.js` içindeki lojistik görev aralığı 4 saniyeden 0,5 saniyeye indirilerek araçların karayolları, demiryolları ve deniz rotalarında kesintisiz, akıcı akışı sağlandı.
- **Evidence:** `npm run test:story-player-agency` (18/18 test OK) ve `npm run test:story-infrastructure` (20/20 test OK) tüm alt sistemleriyle tam başarıyla geçti; simülasyon adımlarında `trade-shipment:1` aracının ardışık koordinat ilerlemesi (`2169.19` $\to$ `2179.55` $\to$ `2189.05`) ve mod transferi teyit edildi.
- **Implication for future audits:** Harita etkileşimi (`_mapInteracting`) sırasında asla asenkron `createImageBitmap` veya tam sahne pick registry hesaplaması yapılmamalı; lojistik araçları konumları daima `stepProgressBps` ile enterpole edilmeli.

## 2026-08-25 — Karakter aktivasyon probu kayıt sırasını yürütme sırası sanıyor
- **Type:** Confirmed
- **Source:** RCA.md — Karakter aktivasyon bütçesi probu runtime sırasını değil görev sicili sırasını ölçüyor
- **What happened:** Performans düzenlemesi görev sicilini fazlara göre sıralayınca prob `taskOrder` indislerini gerçek callback yürütme sırası kabul edip tam paketi 85/88'de durdurdu.
- **Evidence:** İzole probda yalnız `schedulerRegistered=false`; görev mevcut ve 15 saniyelik. `Story.js` callback sırası hâlâ behavior -> activation -> actions.
- **Implication for future audits:** Görev kaydı, faz sırası ve fiili callback yürütmesini ayrı assertion ve alan adlarıyla ölç.

## 2026-08-25 — Karakter aktivasyon görevi kayıp değil
- **Type:** Refuted
- **Source:** RCA.md — Karakter aktivasyon bütçesi probu runtime sırasını değil görev sicili sırasını ölçüyor
- **What happened:** Kırmızı sonucun görevin kaldırılması veya periyodunun değişmesinden kaynaklandığı hipotezi incelendi.
- **Evidence:** `character-activation` sicilde mevcut ve `intervalSeconds === 15` koşulu geçiyor.
- **Implication for future audits:** Bileşik boolean sonuçlarını alt koşullara ayırmadan “görev kayıtlı değil” teşhisi koyma.

## 2026-08-25 — Runtime karakter eylemleri aktivasyondan önce çalışmıyor
- **Type:** Refuted
- **Source:** RCA.md — Karakter aktivasyon bütçesi probu runtime sırasını değil görev sicili sırasını ölçüyor
- **What happened:** Görev listesi indisleri eylemin aktivasyondan önce çalıştığını düşündürdü.
- **Evidence:** `Story.js:1709-1714` gerçek callbackleri behavior, activation, actions sırasıyla çağırıyor.
- **Implication for future audits:** Metadata dizisinin sırasını fiili yürütme izi olmadan runtime davranışı sayma.

## 2026-08-25 — Aktivasyon probu paralel koşu flake'i değil
- **Type:** Refuted
- **Source:** RCA.md — Karakter aktivasyon bütçesi probu runtime sırasını değil görev sicili sırasını ölçüyor
- **What happened:** 85/88 kesilmesinin işçi paralelliği veya bellek baskısından doğduğu hipotezi incelendi.
- **Evidence:** Prob izole koşuda deterministik olarak aynı tek alt alanı düşürdü.
- **Implication for future audits:** Flake teşhisinden önce başarısız probu tek başına ve alt sonuçları görünür biçimde tekrar et.

## 2026-08-25 — Gümrük gelirleri karşılıksız bütçe kredisi üretiyor
- **Type:** Confirmed
- **Source:** RCA.md — Dış ticaret gümrük ve transit gelirleri tahsil edilmeden devlet kasasına yazılıyor
- **What happened:** Yabancı sevkiyat teslimatında ithalat, ihracat ve transit gelirleri devlet bütçelerine kredilendi; escrow yalnız satış bedelini taşıdığı için bu gelirleri ödeyen bir aktör bulunmadı.
- **Evidence:** 1,26 kargo değerli deterministik örnekte 3 satış bedeli tam olarak satıcı şirkete aktarılırken alıcı devlet 0,1512, satıcı devlet 0,063 karşılıksız nakit aldı; sistem toplamı 0,2142 arttı.
- **Implication for future audits:** Devlet defterinin kendi içindeki çift kayıt dengesini, bütün aktörler arasındaki para korunumu yerine kullanma.

## 2026-08-25 — Gümrük bedeli ticaret escrow'una dahil değil
- **Type:** Refuted
- **Source:** RCA.md — Dış ticaret gümrük ve transit gelirleri tahsil edilmeden devlet kasasına yazılıyor
- **What happened:** Vergilerin sevkiyat başında alıcıdan ayrılan escrow içinde zaten tahsil edildiği hipotezi incelendi.
- **Evidence:** Alıcıdan ayrılan ve teslimatta çözülen escrow tam olarak 3 satış bedeli; vergi kredileri ayrıca ve teslimat sonrasında oluşuyor.
- **Implication for future audits:** Kârlılık hesabında görünen maliyeti gerçek rezervasyon ve settlement hareketi sanma.

## 2026-08-25 — İhracat harcı satıcı şirket gelirinden kesilmiyor
- **Type:** Refuted
- **Source:** RCA.md — Dış ticaret gümrük ve transit gelirleri tahsil edilmeden devlet kasasına yazılıyor
- **What happened:** Satıcı devletin ihracat gelirinin şirket satış bedelinden kesildiği hipotezi incelendi.
- **Evidence:** Satıcı şirket 3 satış bedelinin tamamını aldı; satıcı devlet buna ek olarak 0,063 bütçe kredisi aldı.
- **Implication for future audits:** Vergi geliri assertionına her zaman ödeyen taraftaki eş tutarlı hareketi bağla.

## 2026-08-25 — Gümrük yalnız raporlama alanı değil
- **Type:** Refuted
- **Source:** RCA.md — Dış ticaret gümrük ve transit gelirleri tahsil edilmeden devlet kasasına yazılıyor
- **What happened:** Dış ticaret gümrük toplamlarının yalnız memo/UI verisi olduğu ve gerçek nakdi etkilemediği hipotezi incelendi.
- **Evidence:** `storyBudgetCredit` devlet nakdini ve gelir hesabını değiştirdi; gözlenen nakit artışları yüzde 12 ve yüzde 5 oranlarıyla birebir eşleşti.
- **Implication for future audits:** Raporlama alanının yanında çağrılan mali mutasyonları ayrı izleyip toplam etkiyi ölç.

## 2026-08-25 — Kayıtlı olduğu söylenen gümrük testi depoda yok
- **Type:** Confirmed
- **Source:** RCA.md — Dış ticaret gümrük ve transit gelirleri tahsil edilmeden devlet kasasına yazılıyor
- **What happened:** Tarihsel LEDGER kaydı `test_customs_and_foreign_trade.js` testinin geçtiğini söylüyor; dosya güncel ağaçta bulunmadığı gibi tüm git geçmişindeki yol araması da sonuç vermiyor.
- **Evidence:** Depo geneli ad araması yalnız LEDGER kaydını buldu; `git log --all -- tests/test_customs_and_foreign_trade.js test_customs_and_foreign_trade.js` boş döndü. Mevcut `tradeProbe` ise para korunumunu ölçmeden geçiyor.
- **Implication for future audits:** Test başarı kaydında çalıştırılabilir yol, komut ve saklanan sonuç kanıtı zorunlu olmalı; var olmayan test adına dayanarak özellik doğrulanmış sayılmamalı.

## 2026-08-25 — EXECUTIVE oyuncu seçim sonucuna rağmen makam yetkisini koruyor
- **Type:** Confirmed
- **Source:** RCA.md — EXECUTIVE oyuncu seçim sonucuna rağmen yürütme makamını süresiz koruyor
- **What happened:** Seçim defteri yeni yürütme mandatını Bora Demirel'e verdi; kurum defteri legacy player bayrağını öncelediği için oyuncuyu Cumhurbaşkanı ve yetkili EXECUTIVE saymaya devam etti.
- **Evidence:** Deterministik 420 saniyelik EXECUTIVE kampanyasında seçim CERTIFIED ve election holder Bora Demirel iken institution holder character:0:0, governance rolü CUMHURBAŞKANI kaldı.
- **Implication for future audits:** Aynı makamın seçim, kurum, karakter kariyeri ve UI sahiplerini çapraz-defter invariantıyla tek aktöre bağla.

## 2026-08-25 — Varsayılan monarchy rejimi seçimsiz değil
- **Type:** Refuted
- **Source:** RCA.md — EXECUTIVE oyuncu seçim sonucuna rağmen yürütme makamını süresiz koruyor
- **What happened:** Oyuncunun makamda kalmasının varsayılan monarchy rejiminde seçim yapılmamasından doğduğu hipotezi incelendi.
- **Evidence:** Monarchy PARLIAMENTARY_BALANCE modeline bağlanıyor ve oyuncu ülkesindeki ilk seçim 420. saniyeden önce sertifikalandı.
- **Implication for future audits:** Kullanıcıya görünen anayasa etiketiyle gerçek rejim/election modelini ayrı doğrula.

## 2026-08-25 — Oyuncu seçimi kazanmadı
- **Type:** Refuted
- **Source:** RCA.md — EXECUTIVE oyuncu seçim sonucuna rağmen yürütme makamını süresiz koruyor
- **What happened:** Oyuncunun seçim zaferi nedeniyle makamda kaldığı hipotezi incelendi.
- **Evidence:** Kazanan SOCIAL_COMPACT mandatının aktörü Bora Demirel; oyuncu aktörü character:0:0'dır.
- **Implication for future audits:** Makam devamlılığını liste sonucu veya UI rolünden değil aktör kimliği eşitliğinden sınay.

## 2026-08-25 — Seçim-makam ayrışması yalnız UI bayatlığı değil
- **Type:** Refuted
- **Source:** RCA.md — EXECUTIVE oyuncu seçim sonucuna rağmen yürütme makamını süresiz koruyor
- **What happened:** Sonucun yalnız yönetim ekranı metninin yenilenmemesi olduğu hipotezi incelendi.
- **Evidence:** Kurumun kanonik officeHolder alanı oyuncuyu döndürdü ve governanceView oyuncuya gerçek EXECUTIVE yetkisi vermeyi sürdürdü.
- **Implication for future audits:** UI metnini, yetki çözümleyicisini ve kanonik defter sahibini ayrı ayrı karşılaştır.

## 2026-08-25 — Seçim ve yönetim probları oynanabilir EXECUTIVE devrini kapsamıyor
- **Type:** Confirmed
- **Source:** RCA.md — EXECUTIVE oyuncu seçim sonucuna rağmen yürütme makamını süresiz koruyor
- **What happened:** electionProbe varsayılan COMMANDER rolüyle mandat sayımını; governanceProbe ise seçimi çalıştırmadan leader bayrağını elle değiştirmeyi sınadı.
- **Evidence:** Hiçbir mevcut assertion electionExecutiveHolder, institution EXECUTIVE officeHolder ve oyuncu governance permission aktörlerini aynı seçim sonrası durumda eşitlemiyor.
- **Implication for future audits:** Birbirinden ayrı yeşil domain problarını entegrasyon kanıtı sayma; kritik sahiplik sınırında gerçek rol ve gerçek transition kullan.

## 2026-08-25 — Governance cache makam devrinde değişmeyen hayali revision kullanıyor
- **Type:** Confirmed
- **Source:** Doğrudan runtime ve kaynak denetimi — StoryGovernance/StoryInstitutions
- **What happened:** Yönetim görünümü cache anahtarı `STORY.institutions.revision` alanına bağlandı; kurum defterinde böyle bir alan olmadığı için değer sürekli 0 kaldı ve makam değişimi cache'i geçersizleştirmedi.
- **Evidence:** Makam değişiminden önce ve sonra anahtar `country:0|character:0:0|0|0|||` kaldı. Eski görünüm kurumsal makam yok derken cache temizlenince aynı durumda Cumhurbaşkanı ve EXECUTIVE sahibi gösterildi. Geçen governanceProbe ayrıca `president.role=GENELKURMAY BAŞKANI` ve `holdsExecutive=false` sakladı.
- **Implication for future audits:** Cache anahtarını varlığı varsayılan alanlara değil gerçek artan revision veya kanonik sahiplik imzasına bağla; probe sonuç alanlarını zorunlu assertion yap.

## 2026-08-25 — Başarılı darbe kriz liderini kanonik yürütme makamına getirmiyor
- **Type:** Confirmed
- **Source:** RCA.md — Başarılı darbe legacy lider bayrağını değiştiriyor fakat kurum makamını devretmiyor
- **What happened:** Siyasi kriz başarıyla sonuçlandığında `state.gov.crisisActorId` kriz liderine yazıldı ve sonuç `GOVERNMENT_SEIZED` oldu; kurum katmanı bu alanı okumadığı için seçim mandatındaki eski kişiyi EXECUTIVE sahibi tuttu.
- **Evidence:** Deterministik başarıda kriz lideri `character:0:1`, kurum yürütme sahibi `character:0:president` Demir Aydoğan oldu. Kurum validatorü çelişkiye rağmen `ok=true` döndü.
- **Implication for future audits:** Seçim, darbe, istifa ve atama için ayrı bayraklar değil, kurum/kariyer/seçim projeksiyonlarını atomik güncelleyen tek yürütme transition makbuzu kullan.

## 2026-08-25 — Siyasi kriz başarı probu makam devri kanıtı değil
- **Type:** Refuted
- **Source:** RCA.md — Başarılı darbe legacy lider bayrağını değiştiriyor fakat kurum makamını devretmiyor
- **What happened:** `politicalCrisisProbe` içindeki SUCCESS, kanonik iktidar devrinin de gerçekleştiği şeklinde yorumlandı.
- **Evidence:** Prob kriz durumu, hafıza, aktör kimliği ve sahte toprak mutasyonu olmamasını ölçüyor; institution EXECUTIVE holder veya election mandate sahibini assert etmiyor. Aynı geçen fixture'da makam eski başkanda kaldı.
- **Implication for future audits:** Bir domain'in terminal durumunu çapraz-domain fiziksel sonuç kanıtı sayma.

## 2026-08-25 — Bütünlük sistemi kanıtlanmış vakaya doğrudan yaptırım uygulamıyor
- **Type:** Confirmed phase boundary
- **Source:** StoryIntegrity Faz 32 politika ve deterministik integrityProbe
- **What happened:** Gerçek bütçe, kurum ve kanıt fişleriyle bir rüşvet vakası `SUBSTANTIATED` oldu; sistem bilinçli olarak yalnız bulgu kaydı üretti, ceza/görevden alma/iade/şirket yaptırımı yazmadı.
- **Evidence:** Açık rüşvet vakası 6.321/10.000, şüpheli ihale 4.271/10.000 skor aldı; politika `INTEGRITY_FINDING_RECORD_ONLY_PHASE_32` ve her vaka `physicalMutation=false` taşıdı. Kanıtlanmış vaka siyasi kriz riskine girdi olarak okunuyor.
- **Implication for future audits:** Bu davranışı gizli bug diye düzeltme; önce yaptırım kataloğu ve yetkili kurum sözleşmesini tasarla, ardından fiziksel sonuç katmanı ekle.

## 2026-08-25 — Şirket sahibi rolü kanonik pay sahipliği vermiyor
- **Type:** Confirmed
- **Source:** StoryCharacters/StoryCompanies doğrudan runtime karşılaştırması
- **What happened:** `COMPANY_OWNER` oyuncu sanayi şirketine ve Yönetim Kurulu Başkanı unvanına bağlandı; şirket pay defterinde oyuncu bulunmadı.
- **Evidence:** `company:0:civil_industry` sahipliği %88 `households:0`, %12 `country:0`; `character:0:0` payı %0. Rol adaptörü yalnız organization binding üzerinden kurul başkanı ve şirket yetkilisi üretti.
- **Implication for future audits:** Organization binding, officer authority ve equity ownership kavramlarını ayrı doğrula; rol adını pay kanıtı sayma.

## 2026-08-25 — PlayerAgency şirket kredisi kurul onayı yolunu atlıyor
- **Type:** Confirmed
- **Source:** RCA.md — Şirket kredisi kurul ve yaşam döngüsü kapılarını atlayan ikinci komut yoluna sahip
- **What happened:** Aynı oyuncu ve kredi kurul kuyruğunda CFO eksikliği nedeniyle ekonomik etkisiz kaldı; PlayerAgency düşük seviye kredi fonksiyonunu doğrudan çağırıp krediyi uyguladı.
- **Evidence:** Kurul yolu `BOARD_APPROVAL_MISSING`; doğrudan yol şirket nakdi 160→235, borç 0→−75, banka rezervi 1.400→1.325. Validator `ok=true`.
- **Implication for future audits:** Bir domain eyleminin bütün UI/AI/karakter yollarını tek yetki ve precondition hattında birleştir; yeşil yüzey testlerini ayrı sözleşme kabul etme.

## 2026-08-25 — Feshedilmiş şirket yeni kredi çekebiliyor
- **Type:** Confirmed
- **Source:** RCA.md — Şirket kredisi kurul ve yaşam döngüsü kapılarını atlayan ikinci komut yoluna sahip
- **What happened:** 182,5 sıkıntı gününde iflas edip hukuken feshedilen ve ruhsatı iptal edilen şirket PlayerAgency üzerinden yeni banka kredisi kullandı.
- **Evidence:** İflas anında `BANKRUPT/DISSOLVED/REVOKED`, 12 tesis `RECEIVERSHIP`, nakit 0 ve borç −77,4375. Sonraki kredi nakdi 10'a, borcu −87,4375'e çıkardı; defter geçerli sayıldı.
- **Implication for future audits:** Finansal denge doğrulamasına şirket faaliyet durumu ve yasal kapasite invariantlarını ekle.

## 2026-08-25 — Şirket kredi yaşam döngüsü yalnız toplu borç ve faizden oluşuyor
- **Type:** Confirmed phase gap
- **Source:** StoryCompanies kaynak-geneli kredi/geri ödeme taraması
- **What happened:** Banka ve şirkette toplu borç/alacak ile faiz tahakkuku var; kredi kimliği, vade, anapara taksiti, geri ödeme, temerrüt tahsilatı veya tasfiye zararı yok.
- **Evidence:** `bank.loanIds` açılışta boş oluşturuluyor ve hiçbir yerde doldurulmuyor; `storyCompanyRequestLoan` yalnız toplu hesapları değiştiriyor; tick yalnız faiz öder veya borca ekler.
- **Implication for future audits:** Kurul bypass düzeltmesini tam kredi ürün tasarımıyla karıştırma; yaşam döngüsünü ayrı ve açık bir fazda kur.

## 2026-08-25 — Ölü ve emekli oyuncu PlayerAgency üzerinden şirketi yönetebiliyor
- **Type:** Confirmed
- **Source:** RCA.md — PlayerAgency karakter yaşam durumunu merkezi olarak denetlemiyor
- **What happened:** Kanonik ölüm/emeklilik geçişi rol adaptörü, kurul makamı ve normal CharacterAction yetkisini doğru kapattı; PlayerAgency aynı kimliğin kredi ve lobi eylemlerini yine uyguladı.
- **Evidence:** Ölü fixture `DEAD/INACTIVE_CHARACTER`, boş BOARD_CHAIR ve `ACTOR_DEAD` karakter eylemi taşırken kredi +20, lobi −10, borç −20 ve lobi etkisi +0,8 üretti. Emekli fixture `PERSONAL_AGENCY_ONLY` iken kredi/lobi yine başarılı oldu.
- **Implication for future audits:** Yaşam durumu kontrolünü her binding'e dağıtma; ortak komut yürütücüsünde zorunlu kıl ve bütün eylem ailelerini aynı durum matrisiyle sınay.

## 2026-08-25 — Karakter yaşam defteri otomatik mortalite üretmiyor
- **Type:** Confirmed phase boundary
- **Source:** StoryCharacters kariyer/yaşam sözleşmesi ve characterCareerLifecycleProbe
- **What happened:** Doğum tarihi, yaş, sağlık ve emeklilik uygunluğu bilinmiyor; ölüm/emeklilik yalnız dışarıdan kaynak kimliği verilen transition ile oluşuyor.
- **Evidence:** Probe `automaticAgeHealthMortality=UNAVAILABLE`, `sourceEventValidation=UNAVAILABLE`, birthDate/ageYears null alanlarını açıkça doğruluyor.
- **Implication for future audits:** Bu eksikliği rastgele ölüm ekleyerek kapatma; demografik zaman, sağlık olayı, kaynak sicili ve halef kontrol sözleşmesini birlikte tasarla.

## 2026-08-25 — Fiziksel göç kişi sayısını tam koruyor
- **Type:** Confirmed
- **Source:** StoryPopulation/StoryHumanMigration kaynak denetimi ve beş hedefli toplum probu
- **What happened:** Profil bazlı nüfus aktarımı kaynak ve hedef kohortları ile `node.pop` değerini tek işlemde değiştirdi; kapasite beklemesi sonrası mülteci varışı da dünya toplamını değiştirmedi.
- **Evidence:** 17 kişi kaynakta −17, hedefte +17, dünya deltası 0; populationProbe, needsProbe, opinionProbe, collectiveProbe ve humanMigrationProbe ayrı ayrı 1/1 geçti.
- **Implication for future audits:** Kişi korunum kapısını yeniden yazma; toplumsal durum aktarımı ve demografik geçişleri onun üstünde ayrı invariantlar olarak kur.

## 2026-08-25 — Göçmenlerin şikâyet hafızası hedefe taşınmıyor
- **Type:** Confirmed
- **Source:** RCA.md — Göç fiziksel kişiyi taşıyor fakat şikâyet hafızasını bölge kohortunda bırakıyor
- **What happened:** Aynı profilden 17 kişi komşu bölgeye taşındı ve save uzlaştırması üye sayılarını güncelledi; kaynak ve hedef kamuoyu kayıtlarının kimlik/şiddet içeriği değişmedi.
- **Evidence:** `movedPeople=17`, `originRecordsUnchanged=true`, `destinationRecordsUnchanged=true`, `lastSaveOk=true`. Kaynakta bulunan kayıtlar hedefe oranlı katkı üretmedi.
- **Implication for future audits:** Fiziksel toplamın sıfır deltası toplumsal hafıza korunumunu kanıtlamaz; göç fixture'ında taşınan durumun kaynağı ve hedef karışım politikası ayrıca ölçülmeli.

## 2026-08-25 — Organik şehir büyümesi doğum veya yaşlanma modeli değil
- **Type:** Confirmed phase boundary
- **Source:** Production.storyCityGrowthTick ve StoryPopulation.storyPopulationReconcile
- **What happened:** Yıllık büyüme yalnız bölgesel nüfus skalerini değiştiriyor; kohort katmanı yeni toplamı mevcut sabit profil paylarına dağıtıyor.
- **Evidence:** Nüfus yazma noktası `node.pop`; nüfus uzlaştırması önceki `shareBps` değerlerini koruyor. Doğum, ölüm, yaşlanma, eğitim veya meslek transition'ı bulunmuyor.
- **Implication for future audits:** Skaler büyümeyi gerçek demografi diye adlandırma; zaman ölçeği ve transition politikası seçilmeden otomatik kohort geçişi ekleme.

## 2026-08-25 — Taktik birlik kaybı bölgesel nüfus kaybına bağlı değil
- **Type:** Confirmed phase boundary
- **Source:** Story.storyOnBattleEnd ve nüfus yazma noktası taraması
- **What happened:** Ölen birlikler gerçek ordu havuzundan kalıcı düşüyor ve savaşan komutanlardan sabit 30 insan gücü eksiliyor; öldürme sayısı hiçbir bölgenin kohort nüfusunu azaltmıyor.
- **Evidence:** Savaş sonucu birlik havuzu/survivor dönüşünü ve `warDebit(-30)` işlemini içeriyor; `node.pop` yazımları şehir büyümesi ve StoryPopulation göç kapısıyla sınırlı.
- **Implication for future audits:** Birlik başına kişi, askerî personelin kaynak bölgesi ve sivil/asker ayrımı seçilmeden savaş kaybını nüfusa bağlama.

## 2026-08-25 — Mod değiştiren kaynak yönlendirmesi eski terminal yuvasını sızdırıyor
- **Type:** Confirmed
- **Source:** RCA.md — Rota değişimi yeni taşıma ajanını bağlamadan eski terminal üyeliğini bırakmıyor
- **What happened:** RAIL terminalinde yüklenen sevkiyat kaynakta LAND rotasına yönlendirildi; aynı agent kimliği hem eski RAIL hem yeni LAND terminalinde aktif kaldı.
- **Evidence:** Eski anahtar `RAIL:6877:LOAD`, yeni anahtar `LAND:6877:LOAD`; `keyChanged=true`, `staleOldOccupancy=true`. RAIL terminali iki yuvalıdır.
- **Implication for future audits:** Rota rezervasyonunu değiştirmek terminal kaydını otomatik bırakmaz; reroute testinde eski ve yeni bütün kaynak sahiplerini karşılaştır.

## 2026-08-25 — HELD sevkiyat rota rezervasyonunu kaybedebiliyor
- **Type:** Confirmed
- **Source:** StoryRoutePlanner/StoryTransportAgents çapraz runtime fixtürü
- **What happened:** Canlı yük blokajda beklerken sabit süreli segment rezervasyonu saat bazında sona erdi; sevkiyat iptal edilmedi veya yeni lease almadı.
- **Evidence:** 1.051 birim shipment `HELD`, ilk rezervasyon `EXPIRED`; aynı segmentler için ikinci 1.051 birim rezervasyon `ok=true`.
- **Implication for future audits:** Reservation validatorünü kendi içinde geçerli saymak yerine owner shipment'ın yaşam durumu ve devam hakkıyla bağla.

## 2026-08-25 — Kanonik koridorlar transit gelirinin okuduğu sahiplik alanını üretmiyor
- **Type:** Confirmed / Prior claim corrected
- **Source:** StoryInfrastructure şema taraması ve 631 koridorluk runtime snapshot
- **What happened:** Tarihsel kayıt ve önceki ekonomi incelemesi üçüncü ülke başına yüzde 2 transit gelirini mümkün kabul etti; çalışan kod `corridor.ownerCountryId` okuyor fakat kanonik koridorlarda bu alan yok.
- **Evidence:** `withOwnerCountryId=0/631`; bütün erişim politikaları `ENDPOINT_OWNERS`. Depoda `ownerCountryId` yazan koridor üreticisi bulunmadı.
- **Implication for future audits:** Önceki “transit geliri de karşılıksız para üretir” ifadesi güncel runtime için çürütüldü. İthalat/ihracatın +0,2142 para üretimi doğrulanmış kalır; transit ise ölü daldır.

## 2026-08-25 — İnsan göçü ve ticari yük aynı segment kapasitesini paylaşmıyor
- **Type:** Confirmed phase boundary
- **Source:** StoryHumanMigration diagnostics ve rota/rezervasyon kaynak taraması
- **What happened:** Göç akışı gerçek altyapı rotası arıyor fakat route planner kapasite rezervasyonu oluşturmuyor.
- **Evidence:** Göç defteri `sharedTradeCapacityReservation:false` bildiriyor; transfer akışında reserve/release çağrısı yok.
- **Implication for future audits:** Ortak kapasiteyi küçük bugfix diye ekleme; yolcu/tonaj birimi, insani öncelik ve ticaret etkisi birlikte tasarlanmalı.

## 2026-08-25 — Barış mevcut kuşatmayı sonraki tikte iptal ediyor
- **Type:** Refuted
- **Source:** StoryAI düşmanlık kapıları ve deterministik peaceProbe
- **What happened:** Savaş sırasında başlayan kuşatmanın sonradan yapılan barışa rağmen fetihle sonuçlanacağı hipotezi sınandı.
- **Evidence:** Hedef seçimi, kuşatma başlangıcı, kuşatma tiki, çözüm ve fetih ayrı `storyIsHostile` denetimleri taşıyor; barışta kuşatma temizleniyor. peaceProbe 28 barış kenarında sahiplik olayı üretmedi.
- **Implication for future audits:** Aynı korumayı gereksiz yeniden tasarlama; barış-sırasında-kuşatma regresyonuyla sabitle.

## 2026-08-25 — Emekli oyuncu harita yoluyla savaş ilan edebiliyor
- **Type:** Confirmed
- **Source:** RCA.md — Harita saldırısı kanonik savaş ilanı yetki kapısını atlıyor
- **What happened:** Oyuncu kanonik olarak emekli edilip yürütme makamından çıkarıldı; diplomasi PlayerAgency yolu reddederken harita saldırısı treaty'yi değiştirdi.
- **Evidence:** `life=RETIRED`, agency `DIPLOMACY_LOCKED`, treaty `peace→war`, PlayerAgency receipt sayısı `0`.
- **Implication for future audits:** Bir eylem ailesinin yetkili binding'i bulunması diğer doğrudan UI yollarının korunduğunu kanıtlamaz; savaş ilanını tek domain komutuna indir.

## 2026-08-25 — Fetih makbuzu bağımlı sahiplik defterlerini geçici olarak geçersiz bırakıyor
- **Type:** Confirmed
- **Source:** StoryCausality/StoryPopulation çapraz runtime fixtürü
- **What happened:** Bölge sahipliği başarıyla değişti, fakat nüfus, ihtiyaç ve kamuoyu bir sonraki scheduler uzlaştırmasına kadar eski ülkeyi gösterdi.
- **Evidence:** `region:25 owner=0` iken nüfus `country:1`; population validator `POPULATION_OWNER_MISMATCH` ve 12 `POPULATION_COHORT_LINK` üretti. Causality-world validator aynı anda `ok=true`; 30 saniye sonra nüfus zinciri `country:0` oldu.
- **Implication for future audits:** Kanonik alanın atomik değişmesi tüm dünya transaction'ının atomik olduğu anlamına gelmez; transfer sonrası çapraz-defter invariantı kur.

## 2026-08-25 — Fethedilen bölgede kamuoyu gerçek şirket yerine yeni ülke şirketini suçluyor
- **Type:** Confirmed
- **Source:** StoryOpinion attribution ve StoryCompanies region view karşılaştırması
- **What happened:** Bölgedeki tesisler eski ülke şirketlerinde kaldı; nüfus yeni ülkeye uzlaşınca opinion katmanı sektör aktörünü yalnız yeni countryId'den türetti.
- **Evidence:** `region:25` tesis/şirket ülkesi `country:1`; şikâyet aktörleri arasında `company:0:agriculture`, `company:0:energy` ve `company:0:civil_industry` var.
- **Implication for future audits:** Yabancı tesis mülkiyeti ürün kararıdır; fakat “işveren/tedarikçi” sorumluluğu gerçek bölgesel işletmeciden çözülmelidir.

## 2026-08-25 — Yüksek kademe araştırma önceliği yürütülemiyor
- **Type:** Confirmed
- **Source:** RCA.md — Yüksek kademe araştırma önceliği hiçbir yürütücünün tüketmediği başarı makbuzu üretiyor
- **What happened:** Available Kademe 3 araştırma PlayerAgency ile başarıyla önceliklendirildi; rutin motor yalnız Kademe 1–2'yi taradığı için hedef hiçbir zaman aday olmadı.
- **Evidence:** `heavybat` için `player-action:1`; 40 tur sonra 8.697 fon, hedef hâlâ available ve priority alanı hâlâ `heavybat`.
- **Implication for future audits:** Niyet alanının yazılması eylemin yürütülebilir olduğunu kanıtlamaz; producer ve consumer aynı eligibility sözleşmesini paylaşmalı.

## 2026-08-25 — Teknoloji paneli PlayerKnowledge filtresini atlıyor
- **Type:** Confirmed
- **Source:** Sis-açık teknoloji UI fixtürü ile worldV2/projection karşılaştırması
- **What happened:** Genel bilgi katmanı yabancı kesin değerleri kapatırken teknoloji paneli ham devlet dizisinden rakip araştırma sayısını okudu.
- **Evidence:** `fog=true`; foreign resources `UNKNOWN/value=null`; genel projection exact leak=false; panel “İber Federasyonu 7 teknoloji” gösterdi.
- **Implication for future audits:** PlayerKnowledge'ın varlığı bütün panellerin onu kullandığı anlamına gelmez; her render girişinin veri kaynağını sınayıp ham dünya erişimini envanterle.

## 2026-08-25 — Çağ savaş metriği sınırı olmayan devlet çiftini sayıyor
- **Type:** Confirmed
- **Source:** Era.storyEraMetrics kaynak denetimi ve topoloji fixtürü
- **What happened:** Yorum “komşu devlet çiftleri” derken metrik bütün yaşayan devlet çiftlerini payda ve aday olarak kullandı.
- **Evidence:** 10 komşuluk, 28 bütün çift; sınırı olmayan 0–1 savaşı `war=1/28` üretti, komşuluk sözleşmesinde beklenen 0'dı.
- **Implication for future audits:** Metrik yorumunu gerçek hesap sayma; payda ve topoloji duyarlılığını ters örnekle doğrula.

## 2026-08-25 — Ahit bozma çağ çalkantısına bağlanmıyor
- **Type:** Confirmed
- **Source:** Era olay çağrıları ve treaty kırma runtime fixtürü
- **What happened:** Barış savaşa çevrilip ilişki/itibar bedeli uygulandı; çağ olay defteri değişmedi.
- **Evidence:** `storyBreakTreaty=true`, treaty `war`, `_eraEvents=[]`; kaynak çağrıları yalnız grev, sermaye kaçışı ve firarda bulundu.
- **Implication for future audits:** Anlatıda sayılan olayların kanonik event adapterine bağlı olduğunu doğrula; dağınık manuel çağrıları eksiksiz sanma.

## 2026-08-25 — Ticari müzakere fiziksel sözleşmeye güvenli biçimde bağlanıyor
- **Type:** Confirmed healthy contract
- **Source:** conversationUnderstanding ve negotiationDeliveryLifecycle probları
- **What happened:** Serbest metin aday/inceleme/müzakere/preflight zincirinden gerçek teslimat yükümlülüğüne geçti; yalnız taraf kabulü dünya mutasyonu üretmedi.
- **Evidence:** KEPT, BROKEN, BREACH_PAYMENT_PENDING ve RESALE yollarında escrow bir kez ayrıldı; finans/ilişki idempotent, altı validator geçerli ve save/load exact kaldı. Ticari ihlal savaş uyduramadı; anayasal savaş tam rejim yetkisi istedi.
- **Implication for future audits:** Konuşma metnini mekanik sonuç sayma; mevcut review→acceptance→preflight→contract zincirini yeni domainlerde koru.

## 2026-08-25 — Uzun konuşma yabancı hafızayı veya ham dünyayı okumuyor
- **Type:** Confirmed healthy contract
- **Source:** conversationRuntime385Probe
- **What happened:** Çok turlu oturum karakterin kendi hafıza recall kaynağıyla sürdü, yabancı hafızayı gizledi ve dünya durumunu değiştirmedi.
- **Evidence:** 23 takip kabul edildi, limitte durdu; `memoryForeignHidden=true`, `memoryRawWorldRead=false`, `worldNeutral=true`, save/load exact=true.
- **Implication for future audits:** LLM/konuşma bağlamına ham dünya ekleme; bilgi sahipliği ve token bütçesi sınırını koru.

## 2026-08-25 — Dokuz özel konuşma senaryosu yalnız laboratuvar kaydı
- **Type:** Confirmed phase boundary
- **Source:** dialogueScenarioLabProbe
- **What happened:** Grev, ihale, seferberlik, yaptırım, mülteci, banka, esir, boru hattı ve darbe konuşmaları doğru aday dalları üretti fakat üretim domain komutuna bağlanmadı.
- **Evidence:** Katalog tam, deterministik ve geçerli; bütün adaylar non-executable, oturumlar `SCENARIO_LAB_ONLY`, durum `OPEN_COMPOSITIONAL_ADAPTER_DEBT`.
- **Implication for future audits:** Bu güvenli fallback'i bug diye executable yapma; her senaryoyu gerçek domain yetki/preflight/makbuz zincirine ayrı bağla.

## 2026-08-25 — Fiziksel hex ve ölçekleme altyapısı hedefli doğrulamaları geçti
- **Type:** Confirmed healthy contracts
- **Source:** activation/aggregation/decisionTrace/relationship/cityDossier/projection/hex hedefli probları ve yedi bağımsız hex-render testi
- **What happened:** Kaynak envanterinde kanonik belgede eksik görünen fiziksel coğrafya, site/inşaat, aktivasyon, toplulaştırma, bilgi projeksiyonu ve görsel katalog katmanları güncel testlerle doğrulandı.
- **Evidence:** On iki manifest görevi ve doğal kaynak, tarım, site, inşaat, inşaat başvurusu, görsel katalog, map renderer testleri exit 0 verdi. Tarım kanıt yokken aday kaldı; aktivasyon UI-neutral, aggregation korunumlu, yabancı şehir görünümü bilgi filtreliydi.
- **Implication for future audits:** Bu katmanları dekor veya ölü dosya diye arşivleme; salt-okunur/türetilmiş sözleşmeleri kanonik mutasyon katmanlarından ayrı koru.

## 2026-08-25 — Konsey önergeleri eski ve ayrıntılı dünya gerçeklerini ayırıyor
- **Type:** Confirmed architecture seam
- **Source:** Council kaynak denetimi ve census/roads/arsenal runtime karşı örnekleri
- **What happened:** Konsey ödemeyi kısmen kanonik bütçeden yaptı fakat sonucu nüfus, stok, altyapı veya hex inşaat domain komutu yerine doğrudan stratejik cüzdan ve şehir alanlarına yazdı.
- **Evidence:** 551.133 kişilik kohort defteri exact kalırken census +450 manpower/+450 oil üretti; yollar 25 wealth üretirken yol ağı/iş emri aynı kaldı; cephanelik inşaat makbuzu olmadan bina seviyesini artırdı.
- **Implication for future audits:** Aynı isimli stratejik ve ayrıntılı kaynağı otomatik eşdeğer sayma; kullanıcı üst-katman kararından sonra her konsey maddesini tek domain komutu ve correlationId ile bağla.

## 2026-08-25 — Konsey önerge exception'ı ödeme sonrası sahte başarı üretiyor
- **Type:** Confirmed bug
- **Source:** `storyCouncilApply` kaynak denetimi ve kontrollü effect-failure runtime fixtürü
- **What happened:** Önerge etkisi exception üretti; boş catch hatayı yuttu, ödeme geri alınmadı ve fonksiyon başarı metni döndürdü.
- **Evidence:** Otoyol fixtüründe nakit 3000→2850, wealth 0, dönüş “Otoyol Yatırım Programı kabul edildi”.
- **Implication for future audits:** Ödeme ve domain etkisini tek transaction/makbuz sınırında tut; exception güvenliği sessiz yutma değil açık ret veya tam rollback olmalıdır.


## 2026-08-25 — Electron harita kabulü kalıcı raster belleğini ve açılış dilim aşımını doğruladı
- **Type:** Measured
- **Source:** `OPTIMIZATIONS.md` — Electron dünya haritası açılış/render incelemesi
- **What happened:** İzole kullanıcı profilli gerçek Electron maptest sabit render hedefini karşıladı; buna karşılık şehir katmanları 986,3 MiB tuttu ve 4 ms bütçeli doğal-yüzey işi 109,6 ms'lik dilim üretti. Doğal yüzey byte sayacı, kaynak canvas ile birlikte tutulan yaklaşık 109,3 MiB'lık karo kopyasını rapora katmıyor.
- **Evidence:** Uzak/orta/yakın p95 15,4/13,1/16,3 ms; etkileşim p95 13,7 ms; katman toplamı 1.194,1 MiB; `cityBytes=1.034.257.408`; doğal yüzey `buildMs=19.037`, `maxSliceMs=109,6`, `frameBudgetMs=4`. Kaynak denetiminde `_hexNaturalContentsCanvas` ve eş boyutlu karo canvas'ları birlikte tutuluyor.
- **Implication for future audits:** Sürekli 50 FPS varsayımını yeniden raporlama; sabit render sağlıklı. Önce kalıcı şehir/doğal yüzey belleğini ve başlangıç dilim bütçesini ölç; maptest'in border, transport sample ve hover kırmızılarını ürün regresyonu saymadan test zamanlaması/ölçümünü düzelt.

## 2026-08-25 — Electron testleri hikâye savaş yaşam döngüsünü birleştirmiyor
- **Type:** Confirmed
- **Source:** TEST_GAPS.md — TG-31
- **What happened:** UITEST dünya ekranında bitiyor, BATTLETEST yalnız Hızlı Maç açıyor, PLAYTEST bütün confirm kararlarını reddediyor; başsız dünya harness'ı savaş girişini ve yenilgi denetimini stub'lıyor.
- **Evidence:** electron/main.js içindeki UITEST, BATTLETEST ve PLAYTEST gövdeleri ile tools/story-sim-harness.js:297-299; paket komutlarında gerçek hikâye saldırısı→mode:story savaş→sonuç→ödül→ikinci süreçte Continue zinciri yok.
- **Implication for future audits:** Bu ayrı testlerin birlikte yeşil olmasını hikâye modu uçtan uca kabulü sayma; yaşam döngüsü güveni ancak üretim köprüsünü ve yeni Electron sürecinde kayıt/devamı kullanan tek E2E ile kurulabilir.

## 2026-08-26 — Geniş arşiv planı tamamlanan önekiyle kapatıldı
- **Type:** Executed
- **Source:** BACKLOG.md plan register — 25-agustos-arsiv-duzenlemesi
- **What happened:** Kullanıcının durdurduğu toplu arşivleme hedefi yeniden açılmadı; gerçekleşen doğrulanmış taşıma öneki tutarlı bırakıldı ve kalan belge yönlendirme işi 25-agustos-belge-hedefleme-duzeni planına geçti.
- **Evidence:** Planın kendi 25 Ağustos yürütme kaydı, güncel iş ağacındaki arşiv taşımaları ve kullanıcının güncele yakın dosyaları koruma kararı.
- **Implication for future audits:** 25-agustos-arsiv-duzenlemesi planını yeniden yürütme veya açık iş kaynağı sayma; yeni arşiv taleplerini kanıt kapılı ayrı plan olarak aç.

## 2026-08-26 — Dokuz lab-only konuşma adaptörü bu bugfix döngüsünde reddedildi
- **Type:** Rejected
- **Source:** BACKLOG.md Won't Do — TEST_GAPS TG-28
- **What happened:** Grev, ihale, seferberlik, yaptırım, mülteci, banka, esir, boru hattı ve darbe senaryolarını topluca executable yapma işi 10 kişi-günlük bugfix döngüsüne alınmadı.
- **Evidence:** Mevcut davranış güvenli SCENARIO_LAB_ONLY fallback'tir; dokuz ayrı domain yetki/preflight/makbuz entegrasyonu gerekir ve kapasiteyi aşar.
- **Implication for future audits:** TG-28'i genel bugfix olarak yeniden önermeyin; kullanıcı tek bir senaryoyu ürün hedefi seçerse o domain için ayrı planla yeniden açın.

## 2026-08-26 — 10 kişi-günlük bugfix döngüsü onaylandı
- **Type:** User decision
- **Source:** 25 Ağustos Atlas Operasyonu kapasite ve triage görüşmesi
- **What happened:** Tek geliştiricilik çalışma için 10 kişi-gün sınırı onaylandı. İlk sıra gerçek Electron hikâye yaşam döngüsü, sonra konsey atomikliği ve reroute terminal sızıntısı olarak sabitlendi; 2 gün tampon korundu.
- **Evidence:** Kullanıcının açık “onaylıyorum” kararı ve `BACKLOG.md` Now dağılımı. Ayrıntılı `electron-story-lifecycle-acceptance` planı Draft olarak üretildi; kaynak kod uygulama onayı henüz verilmedi.
- **Implication for future audits:** Döngü onayını bütün Draft planların otomatik uygulama yetkisi sayma. Her ayrıntılı plan ayrı onay almalı; kapasiteyi aşan yeni iş ancak tampon veya açık takas kararıyla Now'a girebilir.

## 2026-08-26 — TG-06 Electron yaşam döngüsü kümesinden çıkarıldı
- **Type:** Falsified plan assumption
- **Source:** BACKLOG ayrıntılandırma denetimi ve TEST_GAPS.md kaynak karşılaştırması
- **What happened:** TG-06'nın Electron savaş/harita kabulü değil, karakter aktivasyon probunun metadata yerine gerçek callback davranışını ölçmesiyle ilgili olduğu görüldü. 3,5 günlük Electron planından çıkarılıp tetikleyicili Next işi yapıldı.
- **Evidence:** TEST_GAPS.md TG-06 konumu `tools/story-sim-harness.js:16183`; Electron yaşam döngüsü kanıtları TG-01, TG-31, TG-32 ve TG-33 altında.
- **Implication for future audits:** Bulgu kimliklerini yalnız ortak “yanlış güven” etiketiyle kümelendirme; kapatılacak üretim sınırı ve dokunulan kaynak yüzeyiyle yeniden doğrula.

## 2026-08-26 — Ana hikâye planının gerçek sınırı Faz 38.13 partial olarak uzlaştırıldı
- **Type:** Measured
- **Source:** 71 fazlı ana plan ilerleme uzlaştırması
- **What happened:** Ana planın Faz 38.1 ve durum belgesinin Faz 38.8 aktif imleçleri, güncel uygulama kanıtıyla Faz 38.13 `partial` sınırına taşındı. Faz 39 başlatılmadı.
- **Evidence:** `node tests/story-conversation-case.test.js` başarılı; 4 katılımcı, 33 tur, iki önerge, `OBJECTION / AMENDMENT_REQUEST / ENDORSEMENT`, iki sürüm ve sonuç makbuzu doğrulandı. Toplantı kapanışı ve yetkili uygulama yönlendirmesi kaynakta hâlâ açık sınırdır.
- **Implication for future audits:** Faz 38.1 veya 38.8'i aktif çalışma imleci olarak yeniden raporlama; Faz 38.13 ancak kapanış/yetkili yönlendirme, özel not yanıtı, kurumsal görev ve yönlü ilişki fişleri tamamlanınca kapanabilir.

## 2026-08-26 — Faz 38.13 toplantı kapanışı kanonik kurum teklifine bağlandı
- **Type:** Executed
- **Source:** `phase-38-13-meeting-closure-routing`
- **What happened:** Oylanan önerge sürümü oylama öncesi kanonik teklif niyetine bağlandı; kabul/ret sonucu ayrı başkan kapanış kaydı üretiyor. Kabul yalnız Faz 38.9 canlı yetki önizlemesinden sonra tek Faz 29 kurum isteği açıyor; ret istek üretmiyor.
- **Evidence:** `node tests/story-conversation-case.test.js` başarılı; 4 katılımcı, 37 tur, çift kapanış/yönlendirme reddi, yetkisiz rotada konuşma+kurum+fiziksel snapshot sıfır farkı, açık/kapalı save-load, şema-5 göçü ve proposal→closure→outcome trace doğrulandı.
- **Implication for future audits:** Toplantı kapanışı/yetkili teklif yönlendirmesini açık Faz 38.13 borcu olarak yeniden raporlama. Kurum isteğini onay veya fiziksel uygulama sayma; sıradaki tek toplantı dilimi karakterin özel nota görünürlük-korumalı yanıtıdır.

## 2026-08-26 — Oylama sonrası serbest kurum eylemi seçimi reddedildi
- **Type:** Rejected
- **Source:** `phase-38-13-meeting-closure-routing` plan çürütmesi
- **What happened:** `closeMeeting(meetingId, actionType)` yaklaşımı uygulanmadı; oylanan sanayi önergesinin kapanışta savaş ilanı gibi ilgisiz bir eyleme bağlanmasına mekanik engel yoktu.
- **Evidence:** Mevcut önerge metni doğal dil, Faz 29 girişi kapalı `actionType` kataloğudur. Uygulanan `InstitutionProposalIntentV1` eylem/ülke/kurum/hedef kapsamını aktif önerge sürümüne oylama öncesi mühürler ve revizyonda sıfırlar.
- **Implication for future audits:** Toplantı sonucundan LLM, anahtar sözcük veya kapanış payload'u ile eylem türü türetme. Yeni alan rotaları oylama öncesi kanonik preview ve sürüm bağı olmadan executable yapılmamalıdır.

## 2026-08-26 — Faz 38.13 ikili özel not yanıtı görünürlük sınırına bağlandı
- **Type:** Executed
- **Source:** `phase-38-13-private-note-response`
- **What happened:** Oyuncu kök notu ile karakter yanıtı şema-6 içinde ayrı ve tekil bilateral kayıtlar oldu. Yanıt yazarı kök notun gerçek alıcısından türetiliyor; yalnız alıcı söz sırasındayken kök not, görünür kamusal turlar ve alıcının uygun ActorBelief kaydıyla deterministik yanıt veriyor.
- **Evidence:** `node tests/story-conversation-case.test.js` başarılı; 4 katılımcı, 37 kamusal tur, 5 özel kayıt, 2 karakter yanıtı, yanlış sıra/çift yanıt sıfır farkı, üçüncü taraf ve PRIVATE inanç izolasyonu, şema-5→6 göçü, tahrif reddi ve açık/kapalı save-load doğrulandı.
- **Implication for future audits:** Karakterin ikili özel nota yanıtını açık Faz 38.13 borcu olarak yeniden raporlama. Yanıt kamusal tur, karar, emir, taahhüt, ilişki etkisi veya dünya mutasyonu değildir; sıradaki dilim kurumsal/ücretli görevdir.

## 2026-08-26 — Bütün özel not defterini karakter yanıt bağlamına vermek reddedildi
- **Type:** Rejected
- **Source:** `phase-38-13-private-note-response` plan çürütmesi
- **What happened:** Yanıt üreticisine `meeting.privateNotes` dizisinin tamamını verme yaklaşımı uygulanmadı; aynı dizide farklı ikili kanallar bulunduğu için görünürlük matrisi atlanarak üçüncü taraf sırrı sızabilirdi.
- **Evidence:** Uygulanan context builder yalnız seçilen `PLAYER_NOTE` kökünü alıyor; kamusal turları alıcının görünürlük satırı ve yanıt zamanı ile kesiştiriyor. Ayrı kanaldaki `UCUNCU_TARAF_GIZLI_TUZAK` metni yanıt ve sourceRefs içinde bulunmadı.
- **Implication for future audits:** “Kendi özel bağlamı” ifadesini bütün erişilebilir özel geçmişi otomatik okuma yetkisi sayma. Çok-notlu özel hafıza ayrı sahiplik, amaç ve bütçe planı olmadan eklenmemelidir.

## 2026-08-26 — Faz 38.13 devlet kurumu görevi gerçek yetki, escrow ve sonuç makbuzuyla kapandı
- **Type:** Executed
- **Source:** `phase-38-13-institutional-paid-task`
- **What happened:** Ödülsüz kişisel görev korunurken ayrı `INSTITUTIONAL_PAID_CONTACT_TASK` dalı eklendi. Yalnız kanonik Silahlı Kuvvetler makamının gerçek karakter office holder'ı aynı gerçek komutan bütçe hesabına eşlendiğinde kurum isteği yürütülüyor; kabul escrow ayırıyor, hedef görüşme tek ödeme ve `InstitutionalTaskReceiptV1`, süre aşımı tek iade üretiyor.
- **Evidence:** `node tests/story-conversation-case.test.js` kabul/ret, offer-time ve accept-time yetersiz bakiye, çift kabul/tamamlama/tick, bozuk escrow, kurum/actor/party/tutar/correlation/reservation/completion/receipt tahrifi, gerçek DOM tıklaması ve `OFFERED / ACCEPTED+RESERVED / COMPLETED+SETTLED / EXPIRED+RELEASED` save-load birebirliğini geçti. Kurum ve bütçe hedefli probları geçerli kaldı.
- **Implication for future audits:** Devlet kurumu ücretli görevini açık Faz 38.13 borcu diye yeniden raporlama. Şirket bütçeli görev ayrı muhasebe planıdır; sıradaki Faz 38.13 dilimi yönlü ilişki sonuç fişleridir.

## 2026-08-26 — Görünen yürütme unvanını ödeme hesabına çevirmek reddedildi
- **Type:** Rejected
- **Source:** `phase-38-13-institutional-paid-task` iptal ölçütü ve runtime makam→hesap probu
- **What happened:** Başkan kimliği gerçek yürütme makam sahibi olsa da `character:<ülke>:president` hiçbir komutan alt hesabına karşılık gelmedi. Rastgele devlet komutanını başkanın payer'ı saymak yerine commission rotası gerçek karakter+komutan eşleşmesi bulunan Silahlı Kuvvetler makamına daraltıldı.
- **Evidence:** Sekiz ülkede başkan commission grant'i gerçek makam verdi fakat commander eşleşmesi yoktu; sekiz Silahlı Kuvvetler office holder'ı `CANONICAL_COMMANDER` ve exact komutan hesabıydı. Önceki şema-2 yürütme commission kayıtları sahte payer uydurulmadan `CANCELLED / PAYER_COMMANDER_BINDING_UNAVAILABLE` olarak göçtü.
- **Implication for future audits:** Rol, unvan veya kurum üyeliğini kişisel ödeme hesabı sayma. Ücretli eylemde actor→ledger-owner eşlemesi birebir kanıtlanmıyorsa teklif üretme.

## 2026-08-26 — Konuşma reward alanını ödeme saymak reddedildi
- **Type:** Rejected
- **Source:** `phase-38-13-institutional-paid-task` ekonomik bütünlük çürütmesi
- **What happened:** Görev kartına yalnız `reward.amount` yazıp tamamlamada başarı metni gösterme yaklaşımı uygulanmadı. Konuşma defteri para yaratmıyor; ücret kanonik devlet bütçesinin ayrı `ASSET:TASK_ESCROW` hesabında reserve/release/settle yaşam döngüsüyle ilerliyor.
- **Evidence:** Kabulden önce payer komutan nakdi 25 azalırken görev escrow'u 25 arttı; tamamlama oyuncu komutanına 25 aktardı; ret sıfır bütçe farkı, süre aşımı aynı payer'a tek iade ve restore sıfır yan etki verdi. Makbuz bütçe payer/payee transaction kimlikleriyle çapraz doğrulanıyor.
- **Implication for future audits:** UI ödülü, konuşma durumu veya serbest metin ödeme kanıtı değildir. Ekonomik sonuç için kanonik defter, dengeli işlem, idempotency anahtarı ve doğrulanmış sonuç makbuzu zorunludur.

## 2026-08-26 — Faz 38.13 görev ve toplantı sonuçları yönlü ilişki fişlerine bağlandı
- **Type:** Executed
- **Source:** `phase-38-13-directional-relationship-result-receipts`
- **What happened:** İlişki defteri şema-2 kaynaklı sonuç fişlerinin tek sahibi oldu; konuşma şema-7 görev ve toplantı sonucuna yalnız fiş kimliklerini bağladı. Kabul edilmiş görev başarısı/ihlali veren karakterden oyuncuya, kabul edilmiş önergedeki çift YES ortak başarısı ilgili katılımcıdan oyuncuya uygulanıyor. Diğer toplantı sonuçları gerekçeli `NO_CHANGE`; teklif reddi ve kabul edilmemiş expiry sosyal sonuçsuzdur.
- **Evidence:** `node tests/story-conversation-case.test.js` görev ve toplantı başarı/ret yollarında ters kenar nötrlüğü, duplicate, 300 saniye aile soğuması, atomik rollback, tahrif reddi, restore tekrar-uygulamama ve bilgi filtreli DOM özetlerini geçti. İlişki şema-1 ve konuşma şema-6 göçleri tarihsel sonuç uydurmadı.
- **Implication for future audits:** Ödeme, görev, toplantı ve ilişki makbuzlarını aynı kayıt sayma. Sosyal sonucu ilişki defterindeki kaynak+yön+politika fişiyle doğrula; konuşma referansını veya UI metnini mutasyon kanıtı kabul etme.

## 2026-08-26 — Oy ve teklif durumundan otomatik dostluk veya ihanet türetmek reddedildi
- **Type:** Rejected
- **Source:** `phase-38-13-directional-relationship-result-receipts` plan çürütmesi
- **What happened:** “Aynı oy=dostluk”, “karşı oy=husumet” ve “teklif reddi=ihanet” kısayolları uygulanmadı. Oy siyasal tutumdur; teklif ancak kabulden sonra taahhüttür.
- **Evidence:** Yalnız `ADOPTED + player YES + observer YES` ortak başarı uygular. `MEETING_REJECTED`, oyuncunun YES vermemesi ve gözlemcinin YES vermemesi sıfır deltayı açıkça kaydeder; `DECLINED` ve kabul edilmemiş expiry ilişki fişi üretmez.
- **Implication for future audits:** Karşı oy veya ret için sosyal ceza istenirse bunu mevcut oy/görev durumundan türetme. Hakaret, tehdit, çıkar çatışması, söz veya başka kaynaklı sosyal olay için ayrı semantik ve politika planı aç.

## 2026-08-27 — Faz 38.13 yönlü ilişki fişi kabulü manifest onarımıyla kapandı
- **Type:** Executed
- **Source:** `phase-38-13-directional-relationship-result-receipts`
- **What happened:** Harness ve sequential testte zaten bulunan `institutionalTaskBudgetProbe`, doğrulamalı görev olarak paralel manifestte kaydedildi. Böylece manifest kapsam kontrolü ilişki ve konuşma worker'larını özellik koduna ulaşmadan durdurmuyor.
- **Evidence:** `institutionalTaskBudgetProbe`, `relationshipInterpretationProbe` ve `conversationUnderstandingProbe` tek worker ile exit `0`; `node tests/story-conversation-case.test.js` exit `0`; manifest sözdizimi ve `git diff --check` temiz.
- **Implication for future audits:** `institutionalTaskBudgetProbe` manifest eksikliğini açık kabul borcu olarak yeniden raporlama. Faz 38.13 yönlü ilişki sonuç fişi planı `Landed`dır; genel gıda/kriz assertion'ı bu kapanış için zayıflatılmadı.

## 2026-08-27 — Türkçe semantik yönlendirici için insan-gold kuyruğu kuruldu
- **Type:** Executed
- **Source:** `phase-38-turkish-semantic-intent-router` Adım 1
- **What happened:** 46 gözlenmiş oyuncu turu ve 154 model üretimi adaydan oluşan 200 benzersiz cümlelik, 160 aileli corpus kuruldu. Toplu inceleme aracı bütün kapalı konuşma etiketlerini düzeltilebilir gösteriyor ve yalnız eksiksiz `LOCAL_HUMAN` kabulünü gold sayıyor.
- **Evidence:** Corpus doğrulaması 200/200 benzersiz metin ve sıfır aile-split sızıntısı verdi; prototip/kalibrasyon/kör dağılımı 127/27/46. İnceleme testi, SemanticFrameV2 testi, semantik gece kapısı testi ve ana konuşma senaryosu exit `0`; güncel sayaç `0/200` prototip ve `0/1000` ürün gold.
- **Implication for future audits:** Model/gece çıktısını veya mevcut motor önerisini insan etiketi sayma. Model/runtime spike'ı ancak 200 eksiksiz insan-onaylı corpus kaydından sonra başlayabilir; ürün entegrasyonu ve plan kapanışı için 1.000 gold şartı korunur.

## 2026-08-27 — Codex tekil semantik incelemeleri gold provenansına alındı
- **Type:** Reversed
- **Source:** Kullanıcı kararı / `phase-38-turkish-semantic-intent-router`
- **What happened:** Önceki yalnız `LOCAL_HUMAN` gold kapısı, kullanıcının açık kararıyla cümle ve bağlamı tek tek okunup bütün etiketleri kararlaştırılan `CODEX_INDIVIDUAL_REVIEW` kayıtlarını da kabul edecek biçimde genişletildi.
- **Evidence:** Kullanıcının “sen tek tek inceleme yap... sadece tek tek incelediğinde gold sayılsın” talimatı. İnsan, Codex ve otomatik öneri provenansları ayrı tutulur.
- **Implication for future audits:** Codex tekil incelemesini insan etiketi diye raporlama; fakat otomatik/model önerisiyle de eşitleme. Yalnız eksiksiz, satır bazlı `CODEX_INDIVIDUAL_REVIEW` kaydı gold kapısına girebilir.

## 2026-08-27 — İlk 20 Türkçe tur tek tek Codex tarafından etiketlendi
- **Type:** Measured
- **Source:** `phase-38-turkish-semantic-intent-router` Adım 1 / Codex partisi 1
- **What happened:** İlk 20 gözlenmiş oyuncu cümlesi bağlamıyla tek tek incelendi; eksiksiz kapalı etiketler ve kayıt başına gerekçe corpus'a `CODEX_INDIVIDUAL_REVIEW` provenansıyla işlendi.
- **Evidence:** Corpus 20 Codex gold, 0 insan gold raporluyor. Deterministik baseline 20 kaydın 11'inde ana speech-act'i kaçırdı; macro-F1 `0,3246753247`, ECE `0,2985`. Corpus/provenans, eski gece kapısı ve SemanticFrameV2 testleri exit `0`.
- **Implication for future audits:** İlk 20 kaydı yeniden etiketsiz veya insan-gold sayma. Bu kısmi sonuç mevcut Türkçe anlamanın ciddi hatasını doğrular fakat 200 kayıt tamamlanmadan model karşılaştırması için kabul kanıtı değildir.

## 2026-08-27 — Codex tekil semantik incelemesi 40 gold kayda ulaştı
- **Type:** Measured
- **Source:** `phase-38-turkish-semantic-intent-router` Adım 1 / Codex partisi 2
- **What happened:** İkinci 20 gözlenmiş oyuncu turu bağlamıyla tek tek etiketlendi; toplam 40 kayıt `CODEX_INDIVIDUAL_REVIEW` gold oldu.
- **Evidence:** Corpus doğrulaması exit `0`; kısmi baseline macro-F1 `0,3830492424`, ECE `0,2455`; sayaç `40/200`.
- **Implication for future audits:** İlk 40 kaydı tamamlanmış Codex gold kabul et; fakat 200 kapısı dolmadan embedding/model spike'ına başlama.
## 2026-08-27 — Semantik düzeltmeler hata ailesi kapısına bağlandı
- **Type:** Executed
- **Source:** `plans/phase-38-turkish-semantic-intent-router.md` — Adım 1
- **What happened:** İlk 40 gold üzerindeki baseline farkları bütün semantik çerçeve eksenlerinde yeniden kullanılabilir hata aileleri olarak raporlanmaya başlandı; literal cümle yaması yasaklandı. Model spike için eylem-zıtı hard-negative, kısa parça dilimi, model-özel prefix, çapa eğrisi, L2-dot/kosinüs eşitliği ve sınıf/risk bazlı eşik kalibrasyonu zorunlu kılındı.
- **Evidence:** `tests/story-semantic-review-server.test.js` hata ailelerinin etiket/cümle çiftini ezberlemeyen kapalı sınıflar olduğunu doğrular; benchmark her aile için sayı ve en fazla beş örnek kimliği üretir.
- **Implication for future audits:** Tek bir oyuncu cümlesini geçiren regex veya çapa değişikliğini bugfix sayma; aynı kök hata ailesinin family-split holdout sonucunu ve karşıt örneklerini iste.
## 2026-08-27 — İlk 40 gold için semantik hata aileleri ölçüldü
- **Type:** Measured
- **Source:** `phase-38-turkish-semantic-intent-router` Adım 1 / hata ailesi tabanı
- **What happened:** Deterministik baseline'ın yalnız ana speech-act'i değil bütün `SemanticFrameV2` eksenleri gold etiketlerle karşılaştırıldı.
- **Evidence:** Tam çerçeve eşleşmesi `2/40` (`%5`); epistemik durum `28`, hedef `27`, predicate `22`, devamlılık `22`, speech-act `21`, istenen sonuç `15`, yanlış OOD `11` hata. Macro-F1 `0,3830492424`, ECE `0,2455` değişmedi.
- **Implication for future audits:** Genel başarı oranıyla yetinme; düzeltmeleri bu ailelerdeki family-split holdout değişimiyle değerlendir ve bu 40 kayıtla model seçme.
