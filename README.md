# Pixel RTS

Pixel RTS, aynı savaş motorunu hızlı maç ve hikâye modu arasında paylaşan; hikâye tarafında deterministik, katmanlı bir dünya simülasyonu kullanan Electron tabanlı bir strateji oyunudur.

## Çalıştırma ve doğrulama

```text
npm install
npm start
npm test
npm run test:story:soak
```

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

Bu yalnız temel başlangıç düzeltmesidir. Casus belli, kriz basamakları, yaptırım, kurum onayı ve çok hedefli diplomasi AI’si sonraki fazlardadır. Modern dünya hedefiyle çalışan kod arasındaki güncel farklar [MODERN_DUNYA_EKSIKLERI.md](MODERN_DUNYA_EKSIKLERI.md) içinde izlenir. Tam karakter ve hafıza dalgası Faz 34–38.5’tir.

## Hikâye yönetim çalışma alanı

`js/StoryGovernance.js`, Konsey içindeki `YÖNETİM` sekmesini Faz 29 kurum yetkisi ve Faz 30 devlet kapasitesiyle bağlar. Oyuncu yalnız gerçekten tuttuğu makamın kararını başlatabilir. Kamu yatırımı devlet bütçesinden, yerel seferberlik komuta insan gücünden gerçek maliyet ayırır; kurum onayı ve uygulama fişi tamamlanmadan şehir seviyesi veya garnizon değişmez. Oyuncu karar vermediğinde bu katman dünyayı otomatik olarak değiştirmez.

## Aktif hikâye haritası mimarisi

Aktif script sırası `index.html` ile `tools/story-sim-harness.js` içinde aynıdır:

1. `js/StoryMapRasterAsset.js` — build-time sıkıştırılmış kanonik raster.
2. `js/StoryMapRaster.js` — `820×645` kara maskesi ve RegionId raster sözleşmesi.
3. `js/StoryPoliticalOverlay.js` — sahiplik ve devlet rengiyle üretilen ImageData politik katmanı.
4. `js/StoryMapCache.js` — geometri, sahiplik, çağ, palet ve viewport için merkezî cache geçersiz kılma kapısı.
5. `js/StoryRender.js` — terrain, politik katman, adaptif warp ve ekran çizimi.
6. `js/Era.js` — dünya çağını seçer; gerçek çağ geçişini terrain invalidation’a bağlar.

Veri akışı:

```text
geoData + bölge merkezleri
    → build-time kanonik raster
    → tek kara/region gerçeği
    ├─→ 1350×1062 terrain + çağ paleti
    ├─→ 820×645 politik RGBA/sınır katmanı
    └─→ harita hit-test
terrain + politik katman
    → ortak adaptif warp planı
    → storyCanvas
```

Hikâye dünyası `3000` piksel genişliğindedir; yükseklik GEO oranından türetilir. Terrain ve politik katman bağımsız GEO scanline üretmez. İkisi de aynı kanonik rasterı örnekler.

## Harita cache sözleşmesi

Tüm aktif geçersiz kılmalar `storyInvalidateMapCaches(scope, reason, details)` kapısından geçer:

- `ownership`: yalnız politik veri; canvas belleği yeniden kullanılır.
- `era`: yalnız terrain ve çağ paleti.
- `palette`: terrain ile politik renk verisi.
- `viewport`: yalnız adaptif warp planı.
- `derived`: kara gridi korunarak türetilmiş render katmanları.
- `geometry`: raster, kara gridi, terrain, politik veri ve warp planı.

Çağ paletleri terrain’in gerçek RGB çıktısına uygulanır ve sürümlü `paletteKey` terrain kaynak teşhisinde saklanır. Sahiplik değişimi terrain’i yeniden üretmez.

## Aktif ve arşiv kaynakları

- `js/StoryRender.js` aktif hikâye renderer’ıdır; `index.html` tarafından yüklenir ve pakete girer.
- `js/MapData.js` aktif taktik savaş harita verisidir; `index.html` tarafından yüklenir ve pakete girer. Hikâye renderer’ının kopyası değildir.
- `_arsiv/kok-olu-kopyalar/StoryGeoRender.js` tarihî, bağımsız bir prototiptir. `index.html` tarafından yüklenmez ve Electron `build.files` yalnız `js/**/*` aldığı için dağıtım paketine girmez. Aktif kaynak olarak düzenlenmemelidir.
- Eski `MapData.v2.js` / `js/mapDataV2.js` çiftleri mevcut çalışma ağacında yoktur.

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
