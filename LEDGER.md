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
