# Pixel RTS

Pixel RTS; hızlı maç ile hikâye modunda aynı taktik savaş kaynaklarını kullanan, hikâye tarafında ise deterministik ve katmanlı bir modern dünya simülasyonu kuran Electron tabanlı bir strateji oyunudur. Proje aktif geliştirme aşamasındadır; savaş AI'si, ekonomi, karakter davranışı ve doğal dil görüşmeleri ayrı doğrulama tezgâhlarıyla geliştirilmektedir.

## Güncel geliştirme durumu

- Hızlı maç ve hikâye savaşı aynı `BattleController → Perception → Situation → Planning → Execution` karar zincirini ve aynı birlik/fizik kurallarını yükler. Maç kaydı; motor sürümü, başlangıç durumu, olaylar ve deterministik hash'ler taşır.
- Hikâye dünyası 2032'de sekiz devletin barış içinde başladığı; bölgesel stok, üretim, ticaret, fiyat, bütçe, şirket, nüfus, kurum, seçim, karakter, ilişki ve bilgi katmanlarına sahip bir simülasyondur.
- Faz 38.13 kısmen çalışır durumdadır. Oyuncu karakterlerle görüşebilir, sınırlı görev kabul edebilir ve 3–4 kişilik resmî toplantı açabilir. Toplantılarda konuşma sırası, özel not, kaynaklı tutum, önerge, değişiklik, itiraz, başkan usul kararı, sürüme bağlı oylama ve `MeetingOutcomeReceiptV1` bulunur.
- Toplantıda kabul edilen önerge henüz kendiliğinden bütçe, kurum, ordu veya dünya değerlerini değiştirmez. Yetkili uygulama adaptörü ve toplantı kapanış zinciri sıradaki Faz 38.13 borcudur.
- Serbest metin sohbet motoru bağlam, kaynak sınırı ve karar yetkisini korur; ancak insan düzeyinde doğal ve tekrarsız sohbet tamamlanmış değildir. Gerçek 8B/14B sanal görüşme, adversarial oyuncu ve uzun bağlam testleri bunun için tutulur.
- Savaş AI'si hilesiz eşit kuvvet hedefiyle öğrenen seçici, karşı-olgusal oracle, davranış klonlama ve maç replay araçları taşır. İnsan seviyesinde taktik zekâ sağlandığı iddia edilmez; su/dağ geçişi, birim mikrosu, hedef seçimi ve kuvvet dağılımı sürekli telemetriyle sınanır.

Ayrıntılı ve güncel durum:

- [Hikâye modu ana planı](docs/story/plans/HIKAYE_MODU_KATMANLI_DUNYA_SIMULASYONU_PLANI.md)
- [Hikâye modu uygulama durumu](docs/story/status/HIKAYE_MODU_UYGULAMA_DURUMU.md)
- [Modern dünya eksikleri](docs/story/status/MODERN_DUNYA_EKSIKLERI.md)
- [Savaş AI tasarım planı](SAVAS_AI_TASARIM_PLANI.md)
- [Sohbet motoru geliştirme planı](docs/story/plans/HIKAYE_SOHBET_MOTORU_GELISTIRME_PLANI.md)

## Çalıştırma ve doğrulama

```text
npm install
npm start
npm test
npm run test:story:soak
```

Dar ve hızlı doğrulamalar:

```text
npm run story:conversation-case-test
npm run story:conversation-player-regressions
npm run story:conversation-semantic-frame-test
npm run story:dialogue-move-test
npm run story:dialogue-gpu-preflight
```

`npm test` geniş pakettir ve uzun sürebilir. Yalnız hikâye simülasyonunu paralel işçi havuzuyla çalıştırmak için `npm run test:story`, seri karşılaştırma için `npm run test:story:serial`, iş dağılımını çalıştırmadan görmek için `npm run test:story:plan` kullanılır.

Harita raster varlığı yalnız coğrafya veya bölge geometrisi değiştiğinde yeniden üretilir:

```text
npm run story:build-map-raster
```

Hikâye A/B raporu:

```text
npm run story:ab -- --flag=render.mapCacheInvalidation --output=qa-runtime/story-phase14.6-ab.json
npm run story:ab -- --flag=economy.resourceTaxonomy --output=qa-runtime/story-phase15-ab.json
npm run story:ab -- --flag=economy.productionSectors --output=qa-runtime/story-phase16-ab.json
npm run story:ab -- --flag=economy.regionalStocks --output=qa-runtime/story-phase17-ab.json
npm run story:ab -- --flag=diplomacy.peacefulStart --output=qa-runtime/story-phase17.1-ab.json
npm run story:ab -- --flag=economy.tradeLogistics --output=qa-runtime/story-phase18-ab.json
npm run story:ab -- --flag=economy.marketPrices --output=qa-runtime/story-phase19-ab.json
npm run story:ab -- --flag=economy.stateBudget --output=qa-runtime/story-phase20-ab.json
```

`npm test`, gerçek hikâye kaynaklarını jsdom tezgâhında yükler; sekiz devletli 900 saniyelik deterministik koşuyu, sözleşme doğrulayıcılarını ve hedefli bozuk-veri testlerini çalıştırır. Bu tezgâh gerçek Chromium/GPU kare süresini veya nihai piksel görünümünü kanıtlamaz. Paketlenmiş EXE’de görsel kontrol ve p95 frame profili ayrıca yapılmalıdır.

## Yerel LLM çalışma biçimi

Oyun sohbet ve koçluk modellerini Ollama üzerinden çağırmaz. `electron/llm-host.js`, `node-llama-cpp` tabanlı ayrı bir alt süreç açar; böylece model çıkarımı ana Electron çizim/oyun döngüsünü doğrudan kilitlemez. Model arama sırası kurulum kaynakları, proje `models` klasörü, Electron kullanıcı verisi ve kullanıcının `models` klasörüdür.

Normal oyun yolu uygun GGUF modelini `gpuLayers: auto` ile yükler ve sohbet bağlamı için en çok `8192` tokenlık pencere ister. Gerçek GPU kullanımı donanım, sürücü, llama.cpp ikilisi ve VRAM'e bağlıdır; katmanların bir bölümü RAM'de kalabilir. Bu nedenle yüksek RAM tüketimi tek başına modelin GPU kullanmadığını kanıtlamaz. Durum, `npm run story:dialogue-gpu-preflight` ve gerçek model smoke testleriyle doğrulanmalıdır.

`npm run dist` sırasında `models` içindeki GGUF, lisans ve bildirim dosyaları `extraResources/models` olarak paketlenir. Model dosyası yoksa paketleme onu internetten indirmez; dağıtım öncesi modelin ve lisans dosyalarının gerçekten pakete girdiği kontrol edilmelidir.

## Taktik savaş ve öğrenen AI

Aktif savaş zincirinin ana parçaları:

1. `js/BattleController.js` — karar döngüsü ve order uygulaması.
2. `js/BattlePerception.js` — AI'nin izinli algısı; gizli dünya okuması değildir.
3. `js/BattleSituation.js` — rol, tehdit ve kuvvet durumu.
4. `js/BattlePlanning.js` ve `js/OperationGrammar.js` — plan, sektör, rota ve operasyon adayları.
5. `js/BattleExecution.js` — hareket/saldırı emirleri.
6. `js/BattleOracle.js`, `js/BattleFeatures.js`, `js/BattleSelector.js` — karşı-olgusal öğretmen, özellikler ve öğrenen seçim.
7. `js/BattleDeployment.js`, `js/Unit.js` ve `js/BattleRules.js` — konuşlanma, birlik mikrosu ve fiziksel kurallar.
8. `js/BattleSession.js` — tohum, motor sürümü, telemetri ve replay sözleşmesi.

`scripts/` ve `tools/` altında self-play, turnuva, insan verisi, oracle/DAgger, GPU eğitimi, taktik teşhis ve canlı maç analizi araçları bulunur. Bunlar geliştirici araçlarıdır; `electron-builder` paketine alınmaz. Model başarısı yalnız eğitim skoruyla kabul edilmez: görülmemiş tohum, iki saldıran taraf yönü, farklı konuşlanma, fiziksel replay ve gerçek oyuncu maçı birlikte değerlendirilmelidir.

## Karakter görüşmeleri ve resmî toplantılar

`ConversationCaseV1` günlük sohbet, görev/iş, gizlilik, bildirim/rapor, teklif/müzakere ve resmî toplantı kiplerini aynı kayıt içinde tutar. Oyuncu yazı alanındayken WASD kısayolları metni çalmaz; çalışma alanı yeniden çizilirken taslak, seçim aralığı, odak ve kaydırma korunur. Görüşme açıkken hikâye saati durur.

`MeetingCaseV1` şu anda:

- kanonik makamdan başkan ve doğrulanmış katılımcılar seçer;
- kamusal konuşma sırası ile iki taraflı özel notu ayırır;
- karakterin yalnız kendi `ActorBelief` kayıtlarını ve toplantıda duyduklarını kullanmasına izin verir;
- önergeyi aktif sürüme bağlar, değişiklikte eski sürümü silmeden yenisini üretir;
- itirazı başkana sevk eder ve muhalefet kaydını korur;
- her katılımcıya kendi sırasında tek kabul/ret/çekimser oy kullandırır;
- sonuçta fiziksel etkisiz, doğrulanabilir bir toplantı makbuzu üretir.

Hedefli `story-conversation-case` testi mevcut birleşik senaryoda 4 katılımcı, 33 kamusal tur, iki önerge, üç kaynaklı tepki, iki önerge sürümü, itiraz usul kararı ve dört oy üzerinden kayıt/yükleme ile dünya nötrlüğünü doğrular.

## Hikâye kaynak sözleşmesi

`js/StoryResources.js`, ekonominin sekiz kalıcı kaynak kimliğini ve birim/üretici/tüketici/depolama/taşıma/yokluk etkisi sözleşmelerini tanımlar. Katalog sürümlü, checksum’lı ve katı doğrulamalıdır.

Mevcut `oil`, `manpower` ve `points` alanları silinmez. Bunlar sırasıyla `energy`, `labor` ve `capital` için yalnız yüksek anlam kayıplı `LEGACY_ALIAS` görünümüdür; yazma yetkisi eski alanlarda kalır. Taksonomi adaptörü bu eski alanlardan gerçek stok uydurmaz. Sekiz kaynağın canlı miktarları Faz 17’nin ayrı kanonik bölgesel defterinden gelir.

## Hikâye üretim sözleşmesi

`js/StoryProductionSectors.js`; tarım, enerji, hammadde çıkarımı, sivil sanayi, ileri teknoloji ve savunma sanayisi için sürümlü reçeteleri tanımlar. Birincil sektörler açık doğal kapasite/rezerve, sanayi sektörleri malzeme eşdeğeri korumasına bağlıdır. Girdisiz fiziksel çıktı, kütle kazancı, yanlış kaynak birimi ve yetkisiz üretici katalog doğrulamasında reddedilir.

`storyProductionEvaluate`, kapasite/verimlilik/stok/doğal kapasite girdilerinden deterministik `READY`, `PARTIAL` veya `BLOCKED` teklif ve açıklamalı darboğaz listesi üretir. Fonksiyon saf teklif üreticisi olarak kalır; canlı dünyaya yazma yetkisi yalnız Faz 17’nin atomik commit kapısındadır.

## Hikâye bölgesel stok sözleşmesi

`js/StoryRegionalEconomy.js`, 152 bölgenin sekiz kaynak stoğunu, güvenli hedefini, doğal kapasitesini ve sektör kapasitesini `story-regional-stock-ledger-1` defterinde tutar. Hane, ordu, devlet ve şirket talepleri ayrı önceliklerle tahsis edilir; düşük öncelikli tüketici güvenli rezervi kullanamaz.

Üretim commit’i reçete/hash/miktar ve güncel stokları yeniden doğrular; hata varsa hiçbir girdi veya çıktı yazılmaz. Kıtlık kayıtları tüketici, kaynak, neden, miktar ve etki taşır; tekrarlar birleştirilir ve stok yenilenince `ACTIVE → RESOLVED` olur. Kendi bölgesel stokları oyuncuya doğrulanmış gösterilir; yabancı stoklar istihbarat yoksa `UNKNOWN/null` kalır.

Bu katman tek başına dengeli ekonomi değildir. Faz 18 fiziksel ticareti, Faz 19 fiyat baskısını, Faz 20 devlet bütçesini, Faz 21 gerçek şirket sermayesini ve Faz 22 hilesiz yatırım kararını ekledi. Soyut bölgesel sermaye artık sınırsız büyümüyor; şirket AI’si gerçek nakit, kredi ve fiziksel parçayla kapasite kurabiliyor. Buna rağmen 900 saniyede gıda toplamı yine sıfırdır; karar motorunun bulunması üretim zincirinin otomatik olarak dengelendiği anlamına gelmez.

## Hikâye ticaret ve lojistik sözleşmesi

`js/StoryTrade.js`, siparişin stok ışınlamasına dönüşmesini engelleyen `story-trade-logistics-ledger-1` defteridir. Yük sevkte gönderici stoğundan çıkar, Faz 14 koridorlarında ayak ayak ilerler ve yalnız teslimatta alıcı stoğuna girer. Kara/deniz yükleri ile enerji ağı akışı ayrı modlardır; emek ve sermaye fiziksel yük gibi taşınmaz.

Koridor kapasitesi aynı penceredeki sevkiyatlar arasında paylaşılır. Hasar ilerlemeyi yavaşlatır; kapalı hat yükü `HELD` yapar. Yetkili sözleşme amendment’i hedef depoyu değiştirebilir ve sınır ötesi mülkiyet yalnız teslimatta el değiştirir. Yoldaki koruma denklemi `dispatched = delivered + lost + returned + activeCargo` biçiminde doğrulanır.

Ticaret şemasındaki eski `CLEARING_PENDING_PRICE` politika kimliği kayıt uyumluluğu için korunur. Yeni sınır ötesi sevkiyatta Faz 19 fiyatı kilitlenir, Faz 20 alıcı bütçesinden escrow ayırır ve yalnız fiziksel teslimatta satıcıya aktarır. Kayıp yükte bloke çözülür. Faz 20 öncesinden yolda kalan kargo açılışta finanse edilir; finanse edilemiyorsa mal silinmeden `PAYMENT_RESERVATION_REQUIRED` durumunda bekler. Kendi gelen/giden sevkiyatların şehir dosyasında doğrulanır; yabancı ticaret ayrıntısı istihbarat olmadan `UNKNOWN/null` kalır.

## Hikâye piyasa ve fiyat sözleşmesi

`js/StoryMarket.js`, 152 bölgedeki altı fiziksel mal/enerji için `story-market-price-ledger-1` defterini tutar. Fiyat; gerçekleşmiş talep/teslim/açık, yerel üretim, stok, güvenli hedef, stok günü, yoldaki yük, bekleyen yük ve koridor hasarından türetilen bir endekstir. Baz `100`, politika aralığı `25–800`, tik başına hareket tavanı `%10`dur.

İş gücü mevcut `NON_STOCK` modeli nedeniyle `DEFERRED/null` kalır. Bölgesel sermaye Faz 21 açıkken şirketlerin harcanabilir nakdinin salt-okunur aynasıdır; fiyat tiki bu nakdi, stoğu, siparişi, sevkiyatı veya eski makro enflasyonu değiştirmez. Hane ve üretici sepetleri nüfus ağırlıklı ulusal görünüme toplanır; oyuncu kendi şehrinde fiyat/değişim/kıtlık bandı/stok günü görür, yabancı ayrıntı bilgi sistemi olmadan `UNKNOWN/null` kalır.

Faz 19 denge motoru değildir. Faz 22 açık güncel 900 saniyelik koşuda `611/912` aktif fiyatın kritik banda çıkması, fiyatın bozukluğu değil toplam üretim açığının görünür sonucudur. Ödeme, devlet bütçesi, şirket/banka hesapları, otomatik kredi ve fiziksel girdili kapasite yatırımı çalışır; ücret, kur, mevduat, merkez bankası ve kurum yetkileri Faz 23 ve sonraki fazların borcudur.

## Hikâye devlet bütçesi ve ödeme sözleşmesi

`js/StoryBudget.js`, sekiz devletin nakit, ticaret escrow’su, borç, para ihracı ve kaynak etiketli gelir/gider fişlerini `story-state-budget-ledger-1` içinde tutar. Her işlem çift taraflıdır ve toplamı sıfırdır. Komutan `points` cüzdanları devlet nakdinin alt hesapları olarak mutabakata bağlanır; negatif nakit ve bakiye üstü keyfî harcama reddedilir.

Borç tavanı yakın dönem gelirine bağlıdır; faiz ve anapara dünya günüyle işler, ödenemeyen faiz borca eklenebilir ve uzun gecikme temerrüt üretir. Para basımı ayrı karşı hesapta kalır, enflasyonu yükseltir ve piyasa güvenini düşürür. Oyuncu kendi devlet bütçesini şehir `BÜTÇE` sekmesinde doğrulanmış görür; yabancı mali veriler istihbarat olmadan `UNKNOWN/null` kalır.

Bu katman mali kimliktir, modern ekonominin tamamı değildir. Faz 22 şirketlerin kıtlığa kredi/yatırımla, AI devletlerinin sınırlı hedefli destekle tepki vermesini ekledi. Vergi mükellefi, tahvil alıcısı, kur, ücret, mevduat ağı, kamu hizmeti tahsisi ve kurum yetkisi hâlâ yoktur.

## Hikâye şirket, banka ve yatırım sözleşmesi

`js/StoryCompanies.js`, altı sektörde `48` başlangıç şirketini, `8` bankayı, `412` tesisi ve `152` depoyu `story-company-bank-ledger-1` içinde tutar. Şirket kasası devlet bütçesi değildir. Ortaklık toplamı, tekil tesis sahibi, dengeli fişler, negatif olmayan nakit/rezerv ve toplam para arzı her doğrulamada korunur.

Üretim, ilgili bölge/sektör şirketinin gerçek işletme nakdiyle sınırlıdır. Gider ve toptan gelir şirket bilançosuna geçer; dış ticaret ödemesi satıcı devlete değil malın sahibi şirkete gider. Banka kredisi banka rezervini azaltıp şirket borcunu artırır ve borç/özkaynak tavanına tabidir.

Kapasite yatırımı şirket nakdi, gerçek sanayi parçası ve gerektiğinde elektronik tüketir. `180` dünya günü tamamlanmadan kapasite artmaz. Şirket başvurusu sermaye ve ruhsat tamamlanmadan kayda dönüşmez. Oyuncu kendi şehir şirketlerini `ŞİRKETLER` sekmesinde doğrulanmış görür; yabancı mali ayrıntı `UNKNOWN/null` kalır.

Faz 22 bu aktörlerin ilk ekonomik karar katmanını ekledi: gerçek sinyallerden aday üretir, uygun kredi/yatırımı seçer ve gerçekleşen kapasite sonucunu kaydeder. 30 yılda `7` proje ile durağanlık kırıldı; ancak ikinci yatırım kuşağının sanayi parçası darboğazında durması tam ekonomik zekâ olmadığını gösteriyor. Mevduat ödeme sistemi, hane/ücret pazarı, kur, merkez bankası, özel alıcı muhasebesi ve lobi–kurum etkisi henüz yoktur.

## Hikâye ekonomik AI sözleşmesi

`js/StoryEconomicAI.js`, şirket ve AI-devleti kararlarını `story-economic-ai-ledger-1` içinde tutar. Adaylar stok açığı, dolum oranı, fiyat, marj, nakit, borç tavanı, banka rezervi ve fiziksel yatırım girdilerinden deterministik puanlanır. Uygulama yalnız Faz 20–21’in bütçe, kredi ve yatırım kapılarını çağırır; kaynak, para veya kapasiteyi doğrudan yazmaz.

Şirket yatırım sonrasında en az `80` işletme sermayesi korur. AI devleti yalnız stratejik gıda/enerji açığında ve özel finansman tükenmişken hedefli destek verebilir; ödeme hazineden çıkar ve şirket hesabına aynı tutarda girer. Oyuncu hazinesi otonom devlet AI’sine kapalıdır. Kendi karar gerekçeleri şehir `ŞİRKETLER` sekmesinde doğrulanmış, yabancı kararlar istihbaratsız `UNKNOWN/null` görünür.

Bu ilk karar motorudur, otomatik dengeleyici değildir. 900 saniyede gıda üretimi belirgin artsa da gıda stoğu yine sıfır, kritik fiyat sayısı daha yüksektir. Uzun koşuda yatırım girdisi sanayi parçaları tükenince yeniden planlama zayıflar; emek, ücret, kur, mevduat, kurum ve uluslararası ekonomi sonraki fazlardadır.

## Hikâye diplomasi başlangıcı

Yeni kampanyada sekiz devletin bütün 28 ikili ilişkisi `peace` başlar. Ateşkes süresinin dolması otomatik savaş ilanı değildir. AI genelkurmayı, saldırı emri ve kuşatma çözümü aynı düşmanlık kapısından geçer; oyuncu barıştaki devlete saldırmak isterse önce açık savaş ilanı kararını onaylar.

Bu yalnız temel başlangıç düzeltmesidir. Casus belli, kriz basamakları, yaptırım, kurum onayı ve çok hedefli diplomasi AI’si sonraki fazlardadır. Modern dünya hedefiyle çalışan kod arasındaki güncel farklar [docs/story/status/MODERN_DUNYA_EKSIKLERI.md](docs/story/status/MODERN_DUNYA_EKSIKLERI.md) içinde izlenir. Tam karakter ve hafıza dalgası Faz 34–38.5’tir.

## Hikâye yönetim çalışma alanı

`js/StoryGovernance.js`, Konsey içindeki `YÖNETİM` sekmesini Faz 29 kurum yetkisi ve Faz 30 devlet kapasitesiyle bağlar. Oyuncu yalnız gerçekten tuttuğu makamın kararını başlatabilir. Kamu yatırımı devlet bütçesinden, yerel seferberlik komuta insan gücünden gerçek maliyet ayırır; kurum onayı ve uygulama fişi tamamlanmadan şehir seviyesi veya garnizon değişmez. Oyuncu karar vermediğinde bu katman dünyayı otomatik olarak değiştirmez.

## Aktif hikâye haritası mimarisi

Aktif script sırası `index.html` ile `tools/story-sim-harness.js` içinde aynıdır.
Başlıca harita katmanları:

1. `js/StoryHexWorld.js` / `StoryHexGeography.js` — kanonik altıgen dünya,
   kara, su, kıyı ve geçilemez arazi.
2. `js/StoryHexSettlements.js`, `StoryHexUrbanFootprints.js`,
   `StoryHexSites.js` — şehir, ilçe, fiziksel tesis ve arazi kullanımı.
3. `js/StoryHexRoads.js`, `StoryHexInfrastructureSegments.js`,
   `StoryRoutePlanner.js` — kanonik komşu hücre zincirleri ve hasarlı/kapalı
   altyapı.
4. `js/StoryTransportAgents.js` — gerçek sevkiyat ve kanonik karakter
   yolculuğu projeksiyonu.
5. `js/StoryVisualCatalog.js` — 2010–2100 kurulu teknoloji kademesi, durum,
   atlas ve açık fallback teşhisi.
6. `js/StoryMapRendererV2.js` / `StoryRender.js` — kalıcı RAM yüzeyleri,
   üç LOD, hareketli ajanlar, hit-test ve ekran kompozisyonu.

Veri akışı:

```text
geoData + bölge merkezleri
    → kanonik altıgen dünya (10.584 hücre)
    ├─→ coğrafya + politik sahiplik
    ├─→ 152 şehir + ilçeler + fiziksel tesisler
    ├─→ kara/ray/deniz segmentleri + liman terminalleri
    └─→ seçim / hit-test / bölge dosyası
statik dünya katmanları
    → bir kez üretilen RAM bitmap/karolar
hareketli lojistik + seçim + UI
    → her kare düşük maliyetli kompozisyon
    → storyCanvas
```

Hikâye dünyası `3000` piksel genişliğindedir; yükseklik GEO oranından
türetilir. Coğrafya, politik sahiplik, yol ve hit-test aynı altıgen kimliklerini
kullanır; şehir veya araç ekran koordinatından simülasyon gerçeği üretmez.

## Harita cache sözleşmesi

Tüm aktif geçersiz kılmalar `storyInvalidateMapCaches(scope, reason, details)`
kapısından geçer:

- `ownership`: yalnız politik veri; canvas belleği yeniden kullanılır.
- `era`: yalnız terrain ve çağ paleti.
- `palette`: terrain ile politik renk verisi.
- `viewport`: dünya bitmaplerini yeniden üretmeden yalnız ekran görünümü.
- `derived`: kara gridi korunarak türetilmiş render katmanları.
- `geometry`: raster, kara gridi, terrain, politik veri ve warp planı.

Şehir, ilçe, liman, yol, sınır ve doğal yüzey katmanları kalıcı RAM
bitmapleridir. Kamera sürükleme/zoom bunları yeniden üretmez. Sahiplik değişimi
doğal yüzeyi; araç hareketi yol/şehir bitmaplerini geçersiz kılmaz.

## Aktif ve arşiv kaynakları

- `js/StoryRender.js` aktif hikâye renderer’ıdır; `index.html` tarafından yüklenir ve pakete girer.
- `js/MapData.js` aktif taktik savaş harita verisidir; `index.html` tarafından yüklenir ve pakete girer. Hikâye renderer’ının kopyası değildir.
- `_arsiv/kok-olu-kopyalar/StoryGeoRender.js` tarihî, bağımsız bir prototiptir. `index.html` tarafından yüklenmez ve Electron `build.files` yalnız `js/**/*` aldığı için dağıtım paketine girmez. Aktif kaynak olarak düzenlenmemelidir.
- Eski `MapData.v2.js` / `js/mapDataV2.js` çiftleri mevcut çalışma ağacında yoktur.
- Rafa kaldırılmış hikâye 3D prototipinin kaynak, varlık, test ve kanıtlarının
  tamamı `_arsiv/Story3D-shelved-2026-08-21.zip` içindedir. Aktif ürün Three.js
  yüklemez ve yalnız 2D renderer bildirir.

Arşiv prototipi bilerek tutulmaktadır; çalışan renderer üzerine override olarak bağlanmamalıdır. Kaldırılacaksa ayrı bir kaynak temizliği değişikliği olarak silinmelidir.

## Paketleme

```text
npm run dist:dir
npm run dist
```

Electron paketi `electron/**/*`, `js/**/*`, `assets/**/*`, `index.html` ve `style.css` kaynaklarını alır. Markdown, araçlar ve kök prototip dosyaları pakete alınmaz. Yerel GGUF modeli `models` klasöründen `extraResources/models` altına eklenir.

## Bilinen açıklar

- Gerçek EXE’de 720p/1080p/1440p kıyı ve sınır görünümü henüz bu headless tezgâhla doğrulanamaz.
- Gerçek Chromium compositor/GPU p50–p95 maliyeti ayrıca ölçülmelidir.
- Uzun simülasyonda tek devlet hegemonyası hâlâ açıktır; harita render çalışması bunu çözmüş sayılmaz.
- Hikâye ekonomisinde üretim açığı ve kritik fiyat yoğunluğu sürmektedir; ekonomik karar motoru otomatik denge garantisi değildir.
- Karakter kadrosu, yaşam döngüsü, medya aktörleri, şirket alt makamları ve aktivist dışı yükselme kaynakları tamamlanmamıştır.
- Sohbet yanıtları uzun görüşmelerde tekrara, kaçamak cevaba ve düşük alan çeşitliliğine düşebilir. 8B modelin bulunması bu sorunu tek başına çözmez.
- Toplantı sonucu henüz kurumsal uygulama zincirine bağlanmaz; kabul edilmiş önerge dünya emri değildir.
- Savaş AI modellerinin eğitim metrikleri gerçek oyuncuya karşı insan düzeyi başarı kanıtı değildir.
