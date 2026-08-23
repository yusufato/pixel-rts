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