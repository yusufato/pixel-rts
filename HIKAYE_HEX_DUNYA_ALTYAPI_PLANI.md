# PIXEL RTS — Altıgen Dünya, Dinamik Şehir ve Fiziksel Lojistik Altyapı Planı

**Belge sürümü:** 1.0  
**Kapsam:** Hikâye modu stratejik dünya haritası  
**Durum:** HXD-0–HXD-5 tamamlandı; HXD-6 aktif aşamadır  
**Program kodu:** `HXD` — Hex Dünya Dönüşümü  
**Ana kabul örneği:** Ankara → İstanbul fiziksel kara/demir yolu sevkiyatı  
**Deniz kabul örneği:** İstanbul → İzmir veya İstanbul → Trabzon fiziksel gemi sevkiyatı

## 1. Sonuç hedefi

Hikâye dünyasının tek mekânsal gerçeği sürümlü bir altıgen ızgara olacaktır. Harita artık yalnız çizilen bir arka plan, şehirler sabit koordinatlı ikonlar ve lojistik de görünmeyen gecikme sayacı olmayacaktır.

- Kara, deniz, kıyı, dağ, nehir, geçit ve arazi eğimi altıgen hücrelerde tanımlanır.
- Mevcut 152 idarî bölge silinmez; her biri bir altıgen kümesinin idarî üst görünümü olur.
- Şehir tek bir büyüyen/küçülen ikon değildir; çekirdek, ilçeler, önemli yapılar ve altyapı bağlantılarından oluşan dinamik bir yerleşim kümesidir.
- Yol, demir yolu, enerji hattı ve veri hattı iki bölge arasındaki soyut bağ olmaktan çıkar; komşu altıgenler boyunca fiziksel segmentlerden oluşur.
- Sipariş stoktan düşüp hedefte aniden belirmez. Sipariş, rezervasyon, yükleme, araç, güzergâh, hareket, aktarma, boşaltma ve mali uzlaşma zinciriyle taşınır.
- Gemiler dekoratif resim değildir. Gerçek bir sevkiyat veya görev taşıyan, deniz hücrelerinde ilerleyen dünya varlıklarıdır.
- Teknoloji yalnız `+% hız` vermez; yeni araç, hat, terminal, kapasite, güvenilirlik ve işletme yöntemi açar.
- Oyuncu ve AI aynı yol yapma, rota bulma, araç atama, onarma ve kapasite ayırma API'lerini kullanır.

## 2. Kritik mimari kararı: “Her şey tek hücrede” değil, “her şey altıgen dünyaya bağlı”

Her nesneyi tek altıgenin içine zorlamak yanlış olur. Bu yaklaşım şehirleri masa oyunu piyonuna, yolları kırık zikzaklara ve limanları kara/deniz çelişkisine dönüştürür. Doğru ayrım şöyledir:

| Katman | Gerçek sahibi | Örnek |
|---|---|---|
| Coğrafya | `HexCellV1` | arazi, yükseklik, eğim, su derinliği, kıyı kenarları |
| Değişken hücre durumu | `HexStateV1` | sahiplik, kontrol, hasar, hava, kirlilik, görünürlük |
| Yerleşim/saha | `WorldSiteV1` | şehir çekirdeği, ilçe, fabrika, depo, liman, istasyon |
| Komşuluk altyapısı | `InfrastructureSegmentV1` | yol, ray, köprü, tünel, boru, enerji ve veri hattı |
| Güzergâh | `TransportRouteV1` | birbiri ardına gelen hücre/segment/terminal dizisi |
| Taşıma işi | `ShipmentV2` | kaynak, hedef, mal, miktar, sözleşme, rota, durum |
| Hareketli dünya varlığı | `TransportAgentV1` | tır konvoyu, tren, gemi, ileride uçak veya otonom araç |
| İdarî üst katman | mevcut `RegionModel` | 152 bölgenin altıgen kümeleri ve özetleri |

Bu ayrımın sonucu:

- Şehir merkezi yalnız geçerli kara hücresinde bulunur.
- Kıyı şehri karada kalır; limanı kıyı kenarında ve ona komşu seyredilebilir deniz hücresinde bağlanır.
- Yol bir hücre resmi değil, iki komşu hücre arasındaki fiziksel segmenttir.
- Köprü ve tünel özel segmenttir; kara birimi bunlar olmadan suyu veya yasak eğimi geçemez.
- Gemi yalnız seyredilebilir su hücreleri ve liman terminalleri arasında hareket eder.

## 3. Mevcut sistemle ilişki

Bu program çalışan sistemi çöpe atmayacaktır.

### Korunacak sözleşmeler

- Mevcut 152 bölgenin kalıcı kimlikleri korunur.
- `WorldCommand → WorldEvent → Effect` nedensellik zinciri korunur.
- Stok, sahipli lot, sipariş, ödeme rezervasyonu, sevkiyat manifestosu ve teslim fişi korunur.
- Şirket, depo, tesis, nüfus, kurum ve karakter kimlikleri korunur.
- PlayerKnowledge filtresi korunur; yabancı araç ve altyapı bilgisi otomatik olarak tam görünmez.
- Sabit tik, adlandırılmış RNG akışları, kayıt/yükleme determinizmi ve A/B kapıları korunur.

### Yükseltilecek eski yapılar

- Faz 11 `RegionModel`: bölge merkezi/komşuluğu yerine altıgen üyeliği ve sınır kenarları eklenir.
- Faz 14 `StoryInfrastructure`: 177 kara + 20 deniz soyut koridoru, makro rota önbelleği olarak kalır; fiziksel doğruluk segment grafından gelir.
- Faz 14.2–14.6 harita raster/render: mevcut güzel arazi varlıkları silinmez; altıgen coğrafyanın materyal, doku ve LOD girdisi olur.
- Faz 22/22.1 ekonomi ve lojistik: soyut rota gecikmesi gerçek taşıma planı, kapasite rezervasyonu ve hareketli araçla değiştirilir.
- Faz 33.1 şehir seviye artışı: doğrudan `level +1` yerine inşaat projesi, malzeme, arazi ve nüfus koşullu yerleşim büyümesine göç eder.
- Faz 42 teknoloji: soyut çarpan yerine tesis/araç/hat kabiliyeti ve kurulu taban dönüşümü üretir.
- Faz 47+ savaş: stratejik ikmal, köprü, liman, demir yolu ve kesinti verisini aynı altıgen dünyadan alır.

### Geçiş yasağı

Eski ve yeni sistem aylarca iki ayrı dünya gerçeği olarak çift yazılamaz. Geçiş sırasında eski arayüz için salt-okunur adaptör olabilir; fiziksel mutasyon yalnız bir kanonik sisteme yazılmalıdır.

## 4. Altıgen dünya sözleşmesi

### 4.1 Koordinat ve yön

- `pointy-top` eksenel `q/r` koordinatı kullanılır.
- Kalıcı kimlik koordinattan türetilir: `hex:q:r`.
- Komşu sırası sabit ve sürümlüdür; rota eşitliklerinde kimlik sırası deterministik bağ kırıcıdır.
- Dünya ↔ ekran dönüşümü tek servistedir. Render, hit-test, yol, şehir ve AI ayrı dönüşüm yazamaz.
- Harita sarılmayacaktır; dış dünya sınırı açıkça tanımlanır.

### 4.2 Çözünürlük kararı

Kenar uzunluğu tahminle kilitlenmeyecektir. `3000×2360` dünya için üç aday aynı veriyle ölçülür:

| Aday | Yaklaşık toplam hücre | Amaç |
|---|---:|---|
| 20 dünya birimi | 6.873 | düşük maliyet / kaba ağ |
| 16,1 dünya birimi | **10.584** | kabul edilen ana temel |
| 12 dünya birimi | 19.074 | ayrıntılı şehir ve kıyı karşı-testi |

Seçim; kıyı doğruluğu, şehir aralığı, rota kalitesi, 900 saniye simülasyon maliyeti, kayıt boyutu ve gerçek EXE render p95 ölçümüne göre bir kez yapılır. Canlı kayıt üretildikten sonra hücre boyutu sessizce değiştirilemez.

### 4.3 `HexCellV1` değişmez coğrafya

Her hücre en az şu alanları taşır:

- kimlik ve `q/r`, dünya merkezi ve altı köşe;
- `LAND / WATER / COAST / IMPASSABLE` sınıfı;
- kara ve su kapsama oranı;
- ortalama/minimum/maksimum yükseklik;
- eğim, geçiş zorluğu ve dağ/geçit işareti;
- su derinliği, deniz/göl/nehir kimliği ve seyir sınıfı;
- biyom, toprak, iklim kuşağı ve doğal riskler;
- altı kenar için kıyı, nehir, uçurum veya sınır bilgisi;
- idarî bölge kimliği;
- statik veri sürümü ve checksum.

Kara/deniz kararı yalnız hücre merkezine bakılarak verilmez. Poligon kapsama oranı ve kenar kesişimleri kullanılır; aksi durumda ince kıyılar ve adalar kaybolur.

### 4.4 `HexStateV1` değişken dünya

- sahip ve fiilî kontrol;
- altyapı ve savaş hasarı;
- yangın, sel, kar, fırtına ve geçici geçiş cezası;
- kirlilik, güvenlik ve erişim kısıtları;
- keşif/görünürlük seviyesi;
- hücre revizyonu ve son değişimin nedensellik kimliği.

Statik ve dinamik veri ayrı tutulur. Bir yol kırıldığında bütün coğrafya varlığı yeniden kaydedilmez.

## 5. İdarî bölge ve şehir dönüşümü

### 5.1 Bölgeler

Mevcut bölge kimlikleri altıgen kümelerine atanır. Her bölge:

- üye hücreleri;
- sınır kenarlarını;
- kara/su alanını;
- komşu bölgeleri;
- şehir, tesis ve altyapı özetini;
- makro rota düğümlerini taşır.

Bölge komşuluğu artık elle tanımlanmış tek bağlantı değil, paylaşılan geçilebilir sınır ve ulaşım tesisinden türetilir. Politik sahiplik rengi hücre üyeliğinden çizilir; ayrı kıyı rasteriyle çelişmez.

### 5.2 Şehirlerin karaya sabitlenmesi

Her mevcut şehir için deterministik göç raporu üretilir:

1. Eski koordinatın kapsadığı hücre bulunur.
2. Hücre geçerli kara değilse en yakın uygun kara hücreleri aranır.
3. Aynı idarî bölge, kıyı ilişkisi, topoğrafya ve mevcut bağlantı ağı puanlanır.
4. Şehir çekirdeği en iyi geçerli hücreye taşınır.
5. Eski/yeni konum ve mesafe raporlanır; sessiz büyük yer değiştirme reddedilir.
6. Kıyı şehrine ayrı liman sahası ve deniz bağlantısı atanır.

Zorunlu değişmezler:

- şehir çekirdeği suda olamaz;
- liman olmayan şehir deniz rotasına doğrudan bağlanamaz;
- liman sahası kara kıyısı ile seyredilebilir suyu aynı terminalde birleştirmelidir;
- hiçbir bina su hücresine kurulamaz; özel deniz yapısı ayrı sınıftır.

### 5.3 Dinamik şehir modeli

Şehir `tek ikon + level` olmayacaktır:

- `CORE`: tarihî/idarî çekirdek;
- `DISTRICT`: konut, ticaret, sanayi, askerî, lojistik ve karma ilçeler;
- `LANDMARK/SITE`: belediye, fabrika, depo, hastane, liman, istasyon, enerji tesisi gibi önemli yapılar;
- `UTILITY`: su, enerji, veri, atık ve toplu taşıma bağlantıları;
- `CITY_FOOTPRINT`: şehrin işgal ettiği bitişik veya altyapıyla bağlı hücre kümesi.

Şehir büyümesi şu zincir olmadan gerçekleşmez:

`nüfus/iş talebi → arazi uygunluğu → imar/yetki → finansman → malzeme → iş gücü → altyapı bağlantısı → inşaat → kullanım izni → taşınma/üretim`

Büyümeyi etkileyen gerçekler:

- konut doluluğu ve nüfus baskısı;
- iş, ücret, göç ve güvenlik;
- arazi eğimi, su riski ve tarım arazisi bedeli;
- yol, ray, enerji, su, veri ve atık kapasitesi;
- kurum kapasitesi, ruhsat süresi, yolsuzluk ve kamulaştırma;
- inşaat malzemesi, sermaye, şirket ve teknoloji;
- savaş, afet, bakım ve terk edilme.

Teknoloji şehir görünümünü ve işleyişini kurulu yapılar üzerinden değiştirir. Araştırma tamamlandığı anda bütün şehir bir gecede gelecek çağına dönüşmez.

### 5.4 Şehir görselleştirmesi

- Uzak görünüm: sabit ekran boyutunda şehir rozeti + nüfus/önem sınıfı; ters ölçekleme yok.
- Orta görünüm: şehir ayak izi, ana ulaşım, liman/istasyon ve birkaç önemli siluet.
- Yakın görünüm: ilçeler, gerçek önemli yapılar, şantiye, hasar ve yoğunluk.
- Şehir sprite'ı zoom ile dünyada devleşmez; LOD varlıkları değişir.
- Binalar nüfus ve teknolojiye göre kompoze edilir; rastgele dekor mekanik tesis gibi gösterilmez.

### 5.5 2010–2100 görsel dil ve varlık sicili

Oyun ömrü boyunca yüzlerce, bütün varyantlar sayıldığında `1.000+` görsel dosya beklenmektedir. Bu ölçek renderer içinde yıl/bina/ülke dallarıyla yönetilemez. Bütün fiziksel görünüm `story-visual-catalog-2010-2100-v1` sicilinden çözülür:

- sanat dönemleri `MODERN_2010 / CONNECTED_2030 / AUTOMATED_2050 / ADAPTIVE_2075 / FRONTIER_2090`dır;
- dönem yalnız sanat yönünü ve bulunabilecek varlık paketini belirler, teknolojiyi bedelsiz vermez;
- araştırma görsel kademe için yalnız üst sınırdır; yeni görünüm kurulu ve işletilen tesis/altyapı kaydı olmadan açılamaz;
- şehir, tarla, fabrika, maden, orman, yol, araç, karakter, hasar ve yangın ayrı ailelerdir; tek bir dev birleşik sprite olarak çoğaltılmaz;
- mantıksal varlık kimliği dönem + kurulu kademe + fiziksel durumdan oluşur; sahiplik/ülke rengi ayrı maske katmanıdır;
- paketler harita, görünür dönem, görünür bölge veya olay ihtiyacına göre yüklenir; `1.000+` dosyanın tamamı açılışta RAM/VRAM'e alınmaz;
- her kayıt sürümlü fallback zinciri taşır. Eksik gelecek resmi kırık görsel üretmez fakat QA'da `fallbackDepth/fallbackReason` ile görünür borç bırakır;
- deterministik varyant hücre/tesis kimliğinden seçilir; kamera zoom'u veya her render yeni rastgele görünüm üretemez;
- `OPERATING / CONSTRUCTION / DAMAGED / BURNED / ABANDONED` durumları mekanik kayda bağlıdır. Süs amaçlı yangın, fabrika, tren veya gemi çizmek yasaktır.

İlk çalışan dikey mevcut yerleşim atlasını fallback olarak korur; `CORE / RESIDENTIAL / INDUSTRIAL / CIVIC / DEFENSE / LOGISTICS` seçimini artık görsel sicil yapar. Böylece yeni atlas sayfası veya dönem paketi eklemek savaş/ekonomi kodunu değiştirmez.

## 6. Dinamik altyapı

### 6.1 Segment modeli

Her fiziksel hat, komşu hücreler veya hücre içi terminal arasında segmenttir:

- `ROAD_LOCAL`, `ROAD_TRUNK`, `MOTORWAY`;
- `RAIL`, `RAIL_ELECTRIFIED`, ileride yüksek kapasiteli yük hattı;
- `BRIDGE`, `TUNNEL`, `FERRY_LINK`;
- `PORT_CHANNEL`, `SEA_LANE`, uygun yerde `INLAND_WATERWAY`;
- `PIPELINE`, `POWER_LINE`, `DATA_LINK`;
- ileride `AIR_CORRIDOR` ve özel otonom lojistik hatları.

Her segment şu gerçekleri taşır:

- yapım standardı ve izin verilen araç sınıfları;
- teorik kapasite, ayrılmış kapasite ve anlık akış;
- hız sınırı, eğim, hava ve arazi cezası;
- durum/sağlık, bakım açığı ve arıza riski;
- sahip, işletmeci, erişim, geçiş ücreti ve yaptırım;
- inşa/onarım projesi, kullanılan malzeme ve iş gücü;
- hasar kaynağı, kapanma ve son revizyon.

### 6.2 Yol yapımı ve değişimi

Yol çizme eylemi anında çizgi üretmez:

`ihtiyaç → güzergâh etüdü → alternatifler → arazi/kamulaştırma → kurum kararı → finansman → ihale → malzeme ve iş gücü → segment segment inşaat → denetim → açılış`

Oyuncu/AI:

- yeni yol veya ray önerebilir;
- mevcut hattı genişletebilir;
- köprü/tünel/ferry seçebilir;
- bakım bütçesi ayırabilir;
- savaşta yıkabilir veya onarabilir;
- erişim, ücret ve öncelik politikası koyabilir.

Hatlar aşınır, kapasite kaybeder, kapanır ve yeniden yapılabilir. Rota sistemi altyapı revizyonu değiştiğinde etkilenen güzergâhları geçersiz kılar; her tikte bütün dünyayı tekrar aramaz.

### 6.3 Görsel yol geometrisi

Mantık altıgen komşuluğuna bağlı olsa da yol ekranda hücre merkezlerini birleştiren sert zikzak olmayacaktır. Segment zinciri, arazi ve terminal girişlerini koruyan deterministik spline/geometriye çevrilir. Görsel geometri fiziksel rotayı süsleyebilir fakat başka hücreden kestirme yapamaz.

## 7. Fiziksel lojistik ve hareketli araçlar

### 7.1 Siparişten teslimata kanonik zincir

Ankara'daki bir alıcının İstanbul'dan sipariş vermesi örneği:

1. Alıcı `OrderV2` açar; mal, miktar, teslim yeri, zaman ve ödeme koşulu bellidir.
2. Satıcı gerçek stok/üretim kapasitesini ayırır.
3. Ödeme veya kredi gerçek mali defterde rezerve edilir.
4. `ShipmentV2` yükün kaynak deposunu ve hedef deposunu bağlar.
5. Rota planlayıcı karayolu, demir yolu veya çok modlu adayları çıkarır.
6. Uygun terminal ve araç/konvoy kapasitesi rezerve edilir.
7. Yükleme süresi tamamlanınca araç fiziksel olarak yola çıkar.
8. Araç segmentler üzerinde oyun zamanıyla ilerler; durma, kuyruk, hasar ve yeniden rota gerçek durumu değiştirir.
9. Hedef terminalde boşaltma yapılır.
10. Teslim fişi oluşmadan hedef stok artmaz ve satıcı nihai uzlaşma geliri yazmaz.

Kaynak ve hedef tersse aynı zincir ters yönde çalışır; şehir adına özel kod yazılmaz.

### 7.2 `TransportAgentV1`

Her görünür taşıt en az şunları taşır:

- kalıcı kimlik, araç/konvoy sınıfı ve işletmeci;
- bağlı sevkiyat/manifesto kimlikleri;
- mevcut segment, segment ilerlemesi ve yön;
- hız, kapasite, yakıt/enerji, dayanıklılık ve mürettebat;
- rota planı, sonraki terminal, ETA ve gecikme nedeni;
- `LOADING / MOVING / WAITING / REROUTING / UNLOADING / STRANDED / DAMAGED / COMPLETED` durumu;
- son hareket tikinin deterministik zaman damgası.

### 7.3 Araç çözünürlüğü: gerçek ama ölçeklenebilir

Dünyadaki her koli için bir tır üretilmeyecektir. Hibrit model kullanılır:

- kanonik varlık sevkiyat lotu ve taşıma kapasitesidir;
- aynı hat/zaman/işletmecideki küçük yükler deterministik konvoyda birleşebilir;
- önemli, oyuncu bağlantılı, tehlikeli veya kamera yakınındaki sevkiyat fiziksel ajan olarak görünür;
- uzaktaki sıradan trafik segment akışı olarak toplulaştırılabilir fakat konum/ETA/kapasite korunur;
- kamera yaklaşınca ajan aynı kanonik ilerleme değerinden materyalize edilir; ışınlanmaz;
- ambient araçlar açıkça kozmetiktir ve gerçek yük taşıyormuş gibi UI bilgisi vermez.

### 7.4 Kara yolu taşımacılığı

- Tır yalnız uygun yol standardında ilerler.
- Yol yoksa arazi aracına izin veren ayrı maliyetli sınıf gerekir; sıradan tır tarladan kestirme yapamaz.
- Trafik, kontrol noktası, hava, yakıt, sürücü/işçi ve yol hasarı süreyi etkiler.
- Yol kesilirse araç güvenli hücrede bekler, geri döner veya geçerli alternatif bulur.

### 7.5 Demir yolu

- Tren yalnız kesintisiz uygun ray ve terminal arasında hareket eder.
- Lokomotif, vagon kapasitesi, elektrifikasyon ve hat açıklığı/uyumluluğu dikkate alınır.
- İstasyon kapasitesi, zaman penceresi ve aktarma maliyeti vardır.
- Rayın tek segmenti kırıldığında tren suyun veya arazinin üzerinden atlamaz; bekleme/geri dönüş/aktarma gerekir.

### 7.6 Deniz taşımacılığı

- Dekoratif sabit gemiler ana haritadan kaldırılır veya yalnız gerçek `TransportAgentV1` ile değiştirilir.
- Gemi limanda yüklenir, seyredilebilir su hücreleri/deniz koridorları boyunca ilerler ve hedef limanda boşaltılır.
- Su derinliği, boğaz, kanal, liman kapasitesi, hava, abluka ve erişim hakkı rota seçimindedir.
- Ankara gibi iç şehir doğrudan gemi göndermez; yük önce kara/ray ile limana, sonra gemiye aktarılır.
- Liman kapalı veya işgal altındaysa yeni rota/terminal gerekir; yük hedef stoğa ışınlanmaz.

## 8. Çok modlu rota motoru

### 8.1 İki seviyeli arama

Tek seferde on binlerce hücre üzerinde her sipariş için düz A* çalıştırmak yasaktır.

- Makro katman: bölgeler, şehirler, terminaller ve ana koridor grafı.
- Mikro katman: seçilen koridor içindeki altıgen/segment yolu.
- Rota önbelleği anahtarı; kaynak, hedef, mod, araç sınıfı, erişim politikası ve altyapı revizyonunu içerir.
- Hasar yalnız etkilenen koridor/segment önbelleğini bozar.
- Aynı stok için eşzamanlı rotalar kapasiteyi sanal değil atomik rezervasyonla ayırır.

### 8.2 Rota maliyeti

En kısa mesafe tek amaç değildir. Adaylar şu vektörle karşılaştırılır:

- teslim süresi;
- taşıma ve aktarma maliyeti;
- kapasite ve kuyruk;
- güvenilirlik/hasar riski;
- erişim, sınır, yaptırım ve geçiş ücreti;
- enerji/yakıt ve emisyon politikası;
- sözleşme son tarihi ve ceza riski.

AI, oyuncunun göremediği gizli hasarı bedava bilmez. Kendi bilgisiyle rota seçer; keşif veya bildirim gelince yeniden planlar.

## 9. Teknolojiyle gerçek dönüşüm

Teknoloji ağacı aşağıdaki türde fiziksel kabiliyetler açmalıdır:

- daha ağır/uzun ömürlü yol standardı;
- gelişmiş asfalt, köprü, tünel ve bakım yöntemi;
- daha yüksek kapasiteli veya elektrikli yük treni;
- konteyner terminali ve daha hızlı aktarma;
- daha büyük/etkin gemi ve gelişmiş liman ekipmanı;
- soğuk zincir, tehlikeli madde ve özel kargo;
- filo takip, dinamik rota ve akıllı trafik yönetimi;
- elektrikli/hidrojenli/otonom kara aracı;
- drone veya ileri hava kargo sistemi;
- modüler/prefabrik inşaat ve akıllı şehir altyapısı.

Araştırma yalnız yeteneği açar. Etkin sonuç için lisans, yetişmiş iş gücü, uygun tesis, araç üretimi/satın alımı, terminal dönüşümü, enerji ve bakım gerekir. Eski araçlar bir anda yok olmaz; filo yıllar içinde dönüşür.

## 10. AI davranışı

Şehir, şirket, devlet ve askerî AI aynı mekânsal dünyada farklı hedeflerle çalışır:

- belediye: konut, hizmet erişimi, trafik, afet ve bütçe;
- şirket: stok, maliyet, teslim süresi, müşteri, depo ve filo;
- devlet: stratejik koridor, bölgesel eşitlik, güvenlik ve dış ticaret;
- ordu: ikmal, yedeklilik, köprü/liman güvenliği ve cephe erişimi;
- ajan/hasım: gerçek bilgisi varsa sabotaj, abluka veya dezenformasyon hedefi.

AI yol yapmayı sırf puan büyütmek için değil, açıklanabilir ihtiyaçtan önermelidir. Her proje bir amaç, beklenen fayda, maliyet, alternatif, yetkili aktör ve sonradan ölçülen sonuç taşır.

## 11. Savaş motoruyla sınır

Stratejik altıgen dünya ile taktik savaş alanı aynı ölçek değildir.

- Stratejik hücre; arazi, yaklaşma yönü, yol, köprü, hava, ikmal ve tahliye girdisi üretir.
- Taktik motor kendi ince navigasyonunu kullanır.
- Savaş sonucu stratejik segment hasarı, şehir sahası hasarı, kontrol ve araç kaybı olarak geri yazılır.
- Bir stratejik köprünün yıkılması hem ekonomik rota hem askerî ikmal için aynı fiziksel gerçektir.
- Taktik birlikleri doğrudan stratejik altıgen merkezlerine kilitlemek yasaktır.

## 12. UI ve oyuncu deneyimi

### Harita LOD

- Uzak: ülkeler, ana şehirler, ana koridorlar, büyük filolar ve darboğazlar.
- Orta: şehir ayak izi, yol/ray sınıfı, terminaller, gerçek konvoylar.
- Yakın: ilçeler, yapılar, şantiye, segment hasarı, trafik ve araç durumu.
- Altıgen sınırları uzakta gürültü üretmez; seçim/planlama veya yakın zoomda belirginleşir.

### Çalışma alanları

- Hücre: arazi, sahiplik, geçiş, risk ve üzerindeki gerçek varlıklar.
- Şehir: büyüme nedeni, doluluk, ilçeler, yapılar, altyapı açığı ve projeler.
- Lojistik: sipariş → sevkiyat → araç → rota → ETA → teslim fişi.
- Altyapı: yeni hat, alternatif güzergâh, maliyet, malzeme, süre, kamulaştırma ve bakım.
- Teknoloji: açılan kabiliyet, gereken kurulu taban ve dönüşüm projesi.

Oyuncu ham on binlerce hücre tablosuna boğulmaz. Harita soruyu gösterir; ayrıntı seçilen şehir, hat, araç veya sevkiyat üzerinden açılır.

## 13. Kayıt, göç ve uyumluluk

Yeni kayıt ailesi en az şu varlıkları taşır:

- `HexWorldV1` statik varlık kimliği/checksum referansı;
- değişmiş `HexStateV1` hücreleri;
- bölge → hücre üyeliği sürümü;
- şehir ayak izleri ve sahalar;
- altyapı segmentleri/projeleri;
- terminaller, araçlar ve filolar;
- aktif rotalar, kapasite rezervasyonları ve sevkiyat ilerlemesi.

Göç sırası:

1. Eski dünya salt-okunur açılır ve yedeklenir.
2. Deterministik altıgen varlık üretilir/doğrulanır.
3. Bölgeler hücre kümelerine bağlanır.
4. Şehirler karaya, limanlar kıyıya göç ettirilir.
5. Eski koridorlar fiziksel segment adaylarına dönüştürülür.
6. Aktif sipariş/sevkiyatlar yeni rota planına bağlanır; mal veya para çoğaltılmaz.
7. Nüfus, stok, şirket, tesis, sahiplik ve kaynak mutabakatı alınır.
8. Yeni kayıt ayrı anahtara yazılır ve yeniden açılarak doğrulanır.
9. Ancak kabul sonrası canlı yükleme yeni kayda geçirilir.

Bozuk veya belirsiz göçte şehir/araç uydurulmaz; eski kayıt korunur ve işlem kodlu hata ile durur.

## 14. Performans mimarisi

- Statik hücre alanları nesne yığını yerine typed-array/SoA düzeninde tutulur.
- Dünya chunk'lara bölünür; render, hit-test ve yakın ayrıntı yalnız görünür chunk'larda çalışır.
- Region/HOT-WARM-COLD sistemi hücre ve araç aktivasyon bütçesine genişletilir.
- Uzak sıradan sevkiyat hareketi toplulaştırılır, fakat kanonik ilerleme kaybolmaz.
- Yol geometrisi, bölge sınırı ve arazi LOD'u revizyonla önbelleklenir.
- Rota araması worker havuzuna uygun saf istek/sonuç sözleşmesi taşır; dünya mutasyonu ana sırada yapılır.
- Aynı kaynak/koridor kapasitesi için kararlar atomik admission kapısından geçer.
- Profil olmadan hücre sayısı, araç sayısı veya simülasyon sıklığı azaltılmaz.

Ölçülecek bütçeler:

- gerçek EXE harita render p50/p95/p99;
- 900 saniye headless dünya süresi;
- aktif 1.000/5.000/10.000 sevkiyat ölçeği;
- rota önbellek isabeti ve yeniden planlama maliyeti;
- kayıt boyutu ve yükleme süresi;
- şehir büyümesi ve altyapı hasarı sonrası dirty-chunk maliyeti;
- CPU, RAM ve GPU belleği ayrı ayrı.

## 15. Uygulama programı

Bu program mevcut ana fazları yeniden numaralandırmaz. Ana planın altına çapraz kesen `HXD` yükseltmesi olarak uygulanır.

### HXD-0 — Sözleşme ve referans dondurma

**Durum: `completed` —** Sonuçlar `HIKAYE_HEX_DUNYA_ENVANTERI.md` içinde donduruldu.

- Mevcut şehir, bölge, raster, koridor, sipariş, sevkiyat, depo ve kayıt şemalarını envanterle.
- Ankara–İstanbul ile İstanbul–İzmir/Trabzon referans senaryolarını sabitle.
- Mevcut stok, para, rota, süre, harita ve save karmalarını kaydet.
- Mevcut harita sanat varlıklarını koruma listesine al.

**Çıkış:** Davranış değiştirmeyen baseline ve göç mutabakatı.

### HXD-1 — Altıgen matematik ve statik varlık

**Durum: `completed` —** `HexWorldV1`, build-time metadata varlığı, gerçek EXE/harness yükleme eşitliği ve hedefli testler geçti. Ana temel `10.584` hücredir.

- Eksenel koordinat, komşuluk, dünya dönüşümü, hücre kimliği ve checksum.
- Üç çözünürlük adayını üretip ölç.
- Aynı girdinin byte düzeyinde aynı varlığı ürettiğini kanıtla.

**Çıkış:** Seçilmiş, sürümü kilitlenmiş `HexWorldV1`.

### HXD-2 — Coğrafya rasterinden hücre topolojisi

**Durum: `completed_with_source_debt` —** `10.584` hücrenin tamamı kanonik `StoryMapRaster` üzerinden alan örneklemeli kara/su/kıyı sınıfına alındı. Ortak kenarlar simetrik bit maskeleriyle doğrulandı. Projede kanonik yükseklik/eğim ve iç-su türü kaynağı bulunmadığı için bunlar uydurulmadı; açık veri borcu olarak taşındı.

- Kara/su kapsama, kıyı kenarı, yükseklik, eğim, dağ ve seyredilebilir su.
- Ada, dar boğaz, kıyı ve göl karşı-testleri.
- Kara ve deniz geçiş değişmezleri.

Uygulanan gerçek kaynak ayrımı:

- `StoryMapRaster.landMask/regionIds`: hücre başına 19 sabit örnekle kara kapsaması, bölge çoğunluğu ve kıyı sınıfı;
- `GEO.ranges`: yalnız kategorik dağ koridoru ve geçilemez tepe adayı; metre veya eğim değildir;
- `GEO.rivers`: kategorik nehir yakınlığı;
- yükseklik/eğim/iç-su türü: `UNAVAILABLE_NO_CANONICAL_SOURCE` ve sonraki veri paketi borcu.

İstanbul'un eski geometrik hücresi `%31,58` kara kapsamasıyla kara ulaşımına uygun çıkmadı. Kaynağı eğip bükmek yerine en yakın kara erişimli kıyı hücresine `15,684` dünya birimi deterministik göç uygulandı. Aynı kural bütün şehirlerde sürümlü göç raporuyla çalıştırıldı.

**Çıkış:** Görselden bağımsız doğrulanmış fiziksel coğrafya.

### HXD-3 — Bölgelerin altıgen kümelerine göçü

**Durum: `completed` —** `152/152` bölge temsil ediliyor, `7.517` kara/kıyı hücresinin tamamı atanmış ve `2.953` fiziksel idarî sınır kenarı doğrulanmıştır. `HexPoliticalView` her hücre sahibini bölge sahibinden türetir; `460` devlet sınırı kenarı yalnız farklı sahipli komşulardan oluşur. Canlı bölge değerleri değiştirilmez veya çift yazılmaz.

- 152 kimliği koru; üyelik, sınır ve komşuluk üret.
- Sahiplik/politik overlay'i hücrelerden çiz.
- Nüfus, şirket, tesis ve kaynak toplamlarını değiştirme.

HXD-3.1 önemli semantik ayrımı kanıtladı: eski `node.neighbors` listesi fiziksel sınır değildir. Yeni geometri `362` fiziksel komşu çifti, eski liste `177` mantıksal bağlantı çifti üretir; yalnız `141` çift ortaktır. Bu nedenle eski liste yeni sınır grafiğinin üstüne kopyalanmayacak ve yeni fiziksel grafik de çalışan ulaşım/lojistik bağlantısı sanılmayacaktır.

HXD-3.2 kapanış sonucu:

- politik sahiplik `story-hex-political-view-1` ile salt-okunur hücre üyeliğinden türetildi;
- nüfus, stok, şirket, tesis, depo, para, sahiplik ve altyapı kaynak/projeksiyon karması birebir eşitlendi;
- piksel overlay altıgen üyelik ve sahiplik checksum'larını yayınlayarak HXD-5 render göçüne kadar ayrışmaya kapatıldı;
- türetilmiş sidecar kayıt dosyasına yazılmadı; save/load sonrasında birebir yeniden üretildi;
- fiziksel komşuluk ile ulaşım bağlantısı farklı API ve teşhis alanlarında korundu.

**Çıkış:** Eski ve yeni bölge toplamları birebir.

### HXD-4 — Şehir ve liman göçü

**Durum: `completed_with_source_debt` —** `152/152` şehir kendi idarî bölgesindeki benzersiz, geçilebilir kara çekirdeğine bağlandı. Geometrik çekirdeği geçersiz olan `17` şehir deterministik taşındı; denizde/geçilemez dağda şehir kalmadı. `59` şehir liman hizmeti aldı ve bunlar `58` tekil fiziksel kıyı terminaline bağlandı. Eski 20 deniz koridorunun `29` zorunlu şehir ucunun tamamı geçerlidir.

- Bütün şehirleri geçerli kara hücresine sabitle.
- Kıyı şehirlerine gerçek liman terminali kur.
- Yer değiştirme raporu ve kabul eşikleri.

Kaynak geometri borcu gizlenmedi: İzmir'in kendi idarî bölgesinde, Beyrut'un ise mesafe tavanı içinde kendi bölgesinde uygun kıyı terminali yoktur. Mevcut deniz bağlantılarını sessizce silmek veya bölge rasterını boyamak yerine iki hizmet `LEGACY_GEOMETRY_FALLBACK` olarak en yakın gerçek terminale bağlandı. İzmir Bursa bölgesindeki terminali `101,944`, Beyrut Tel Aviv bölgesindeki terminali `89,530` dünya birimi mesafede kullanır. Beyrut ve Tel Aviv aynı kara/su kenarını kullandığı için fiziksel tesis bir kez oluşturulur, iki şehir hizmet kaydı aynı terminal kimliğine bağlanır.

Yerleşim sidecar'ı kayıt dosyasına yazılmaz; `sourceHash fnv1a32:8bc563a0` ve `settlementHash fnv1a32:16e636c9` kayıt/yükleme sonrasında birebir yeniden türetilir. Typed-array yükü `3.648 bayt`tır.

**Çıkış:** Denizde şehir `0`; geçersiz liman `0`.

### HXD-5 — Altıgen render, seçim ve LOD

**Durum: `complete` —** İlk bağlantı diliminde şehir sprite'ı, kamera merkezleme, panel odağı, yedek hit-test ve kara yolu uçları eski `lx/ly` koordinatı yerine HXD-4 çözülmüş şehir çekirdeğini kullanmaya başladı. Görsel liman ağı tahminî kıyı aramasından çıkarıldı; `58` fiziksel terminal ve mevcut `20` deniz bağlantısından türetiliyor.

İkinci dilimde politik görünüm `hex-political-overlay-canvas-1` ile `7.517` atanmış kara/kıyı hücresini gerçek altıgen çokgenlerden üretmeye başladı. `460` devlet sınırı ortak kenarı yalnız bir kez çiziliyor; kara/su tıklaması aynı `storyHexWorldCellAt` çözümleyicisini kullanıyor. Yakın LOD grid'i `4,2×` oranından sonra açılıyor ve viewport culling kullanıyor: örnek `600×500` dünya penceresinde `10.584` yerine `506` hücre işlendi. Arazi ve grid aynı `fnv1a32:160c78e9` raster kaynağı ile `fnv1a32:76d987bd` coğrafya karmasını yayımlar; orta EXE görünümünde `307` hücre (`244` kara / `63` su), yakın görünümde `73` kara hücresi işlendi.

Gerçek Electron kabulünde kanonik `1640×1290` politik canvas ilk yapımı sistem yüküne göre `21,1–55,1 ms` aralığında ölçüldü; önceki `6,729 ms` yalnız izole headless çizim maliyetiydi ve EXE değeri diye kullanılmayacaktır. İlk canlı profilde toplam p95 uzak/orta/yakın `349,9 / 438,7 / 406,0 ms` idi. Ağ, yerleşim ve komutan katmanları sürümlü ekran önbelleklerine alındı; hareketli saldırı/nabız işaretleri canlı bırakıldı. Yoğun sistem yükündeki muhafazakâr 45-kare sonuç `22,2 / 20,3 / 19,0 ms`, son otomatik kabul koşusu `7,5 / 7,5 / 6,0 ms` p95 verdi; ikisi de `33,4 ms` kapısının altındadır. On beş şehir hit-test örneğinde ortalama ve en yüksek hata `0`; konsol problemi `0` oldu. Uzak/orta/yakın ekran görüntüleri altıgen/arazi, şehir, etiket ve yol hizasını korudu.

- Mevcut arazi/sanat katmanlarını altıgen coğrafyaya bağla.
- Hücre/şehir/yol hit-test'ini tek dönüşüme geçir.
- Uzak/orta/yakın şehir boyut ve yoğunluk davranışını düzelt.

**Çıkış:** Görsel kalite, p95 render ve seçim doğruluğu kabulü.

### HXD-6 — Dinamik şehir çekirdeği

**Durum: `in_progress` — HXD-6.1 ayak izi, HXD-6.2 LOD, HXD-6.3 bellek izolasyonu ve HXD-6.4 görsel sicil bağlı.**

- Şehir ayak izi, ilçe, önemli yapı, kapasite ve arazi uygunluğu.
- Mevcut `level` değerini uyumluluk görünümüne indir.
- İlk gerçek konut veya lojistik ilçe inşa zinciri.

HXD-6.1'de `story-hex-urban-footprint-1`, bütün `152` şehri HXD-4 çekirdeğinden başlayarak nüfus sicili, zenginlik, altı üretim binası ve liman hizmetine göre `RESIDENTIAL / INDUSTRIAL / CIVIC / DEFENSE / LOGISTICS` ilçelerine ayırır. `level`, nüfus sicili veya `node.pop` bulunmadığında kullanılan açık `LEGACY_LEVEL_POPULATION_FALLBACK` dışında ayak izi kaynağı değildir. Başlangıçta bu fallback'i kullanan şehir sayısı `0`dır.

Toplam `574` benzersiz fiziksel hücre vardır: `152` çekirdek, `196` konut, `81` sanayi, `44` sivil, `44` savunma ve `57` lojistik hücresi. İstenen `425` ilçenin `422`si yerleşti. Beyrut ve Tel Aviv bölgelerinde çekirdek dışında yalnız birer geçilebilir kara hücresi olduğu için toplam `3` ilçe başka bölgeye taşınmadı; adları ve açık miktarları kaynak coğrafya borcu olarak raporlanır. Sidecar `2.028 bayt`, ayak izi karması `fnv1a32:4999e71a`dır.

Eski ekran-uzayı rastgele ilçe saçılımı, HXD-6 mevcutken kullanılmaz. Orta/yakın LOD ilçeleri kendi gerçek altıgen merkezlerinde çizilir. Soğuk prob bütün alt coğrafya sidecar'larıyla `147,158 ms`; önceden gruplanmış coğrafi adaylarla nüfus/bina değişimi sonrası sıcak rebuild `2,370 ms`, değişmeyen cache kontrolü `1,101 ms` ölçüldü. Gerçek Electron p95 uzak/orta/yakın `8,7 / 8,1 / 7,9 ms` ile HXD-5'in `33,4 ms` kapısını korudu.

HXD-6.2'nin ilk görsel/etkileşim diliminde şehir sprite'ı sabit HUD pini olmaktan çıkarıldı. Başkent uzak/orta/yakın ölçekte `32 / 80 / 114 px`, tier-2 şehir `23 / 57 / 82 px`, küçük şehir `10 / 25 / 36 px` olur; yakınlaşırken hiçbir şehir küçülmez. Görsel kademe HXD-6 nüfusu ve fiziksel ilçe sayısından türetilir, `node.level` yalnız HXD-6 yoksa uyumluluk fallback'idir. Statik açık-deniz gemileri kaldırıldı: gerçek `TransportAgentV1` olmadan araç çizmek yasaktır.

HXD-6.4'te `story-visual-catalog-2010-2100-v1` eklendi. Beş sanat dönemi, beş kurulu teknoloji kademesi, beş fiziksel durum ve sekiz tembel-yükleme paketi tek sözleşmede ayrıldı. Kritik değişmez otomatik testtedir: araştırılmış gelecek teknolojisi tek başına şehri değiştiremez; görsel kademe kurulu tesis ile araştırma tavanının küçüğüdür. Mevcut `4×4` yerleşim atlası kontrollü fallback olarak kalır ve renderer'ın çekirdek/ilçe satır seçimi sicile bağlanmıştır. Yeni dönem görselleri henüz üretilmediği için `CONNECTED_2030+`, hasar ve inşaat durumları açık `REQUESTED_ASSET_MISSING` borcu taşır.

Sicilin ilk fiziksel manifesti altı şehir ailesini (`CORE / RESIDENTIAL / INDUSTRIAL / CIVIC / DEFENSE / LOGISTICS`) kayıt altına alır. Çözümleyici tam dönem/kademe/durum varlığından başlayıp aynı kademe, modern dönem ve son olarak modern baseline varlığa deterministik düşer; hiçbir kayıt yoksa sessiz boşluk yerine `NO_REGISTERED_ASSET_FALLBACK` üretir. Gerçek Electron kabulünde açılış tıklaması `1.689 ms`, ilk render `13,3 ms`; p95 uzak/orta/yakın `9,4 / 8,4 / 8,8 ms`, kamera etkileşimi `9,0 ms`, şehir hit-test hatası ve konsol problemi `0` oldu. Görsel kabul kareleri `qa-runtime/map-visual-catalog-v1` altındadır.

Gerçek Electron kamera probu üç koşuda sabit p95'i uzak/orta/yakın `4,5–10,8 / 6,0–14,6 / 5,3–10,8 ms`, sürükleme+zoom p95'ini `4,5–12,2 ms` ölçtü. Yol, şehir, kıyı ve komutan ekran katmanları etkileşim sırasında kamera dönüşümüyle yeniden kullanılır; fare hareketleri `requestAnimationFrame` ile kare başına bire indirilir. CPU yüküne bağlı etkileşim-sonu kesin katman uzlaşması `163,2–369,3 ms` sürmektedir; en ağır koşuda `network 230,0`, `settlement 93,4`, `commander 30,6 ms` ölçüldü. Sürekli kasma çözülmüş olsa da bu tek-kare uzlaşma HXD-7 öncesi açık P1 performans borcudur.

**Çıkış:** Nüfus/teknoloji/yapı nedeniyle görünür ve mekanik büyüyen tek şehir dikeyi.

### HXD-7 — Fiziksel altyapı segmentleri

**Durum: `in_progress` — HXD-7.1 kara segmenti sicili, kapasite darboğazı, kayıt/yükleme ve hasar görünümü bağlı.**

- Yol/ray/köprü/tünel/liman/enerji/veri segment şeması.
- Eski 591 koridoru makro üst katmana bağla.
- Yapım, bakım, hasar, kapanma ve onarım durumları.

**Çıkış:** Tek segmentin kırılması yalnız ilgili fiziksel akışı etkiler.

HXD-7.1, `177` makro kara koridorunu kanonik altıgen komşuluk zincirine indirdi. Gerçek dünyada `955` benzersiz fiziksel kenar oluştu; `84` kenar birden fazla kara koridoru tarafından paylaşılır, `84` kenar kıyı koşulundan `BRIDGE`, `9` kenar yüksek dağ yoğunluğundan `TUNNEL`, kalanlar `ROAD` sınıfındadır. Her segment kapasite, bakım baz puanı, hasar baz puanı, etkinlik, `CONSTRUCTION / OPERATING / DAMAGED / CLOSED / UNDER_REPAIR` yaşam durumu ve kalan onarım süresi taşır.

Makro koridor kapasitesi artık yalnız koridorun soyut hasarından gelmez; kullandığı fiziksel segmentlerin en kötü durum katsayısı ile çarpılır. Paylaşılan tek kenarın hasarı yalnız o kenarı kullanan kara koridorlarını ve aynı fiziksel güzergâha açıkça bağlı enerji/veri üst katmanlarını etkiler. Segment revizyonu ağ RAM katmanının anahtarına girer; hasarlı kenar sarı/turuncu, kapalı kenar kırmızı kesikli görünür. Render FPS'i veya kamera hareketi fiziksel durumu değiştirmez.

Eski topolojide kara komşuluğu sayıldığı hâlde geçilebilir kara zinciri bulunmayan `12` koridor açıkça `NO_PHYSICAL_LAND_PATH` borcudur. Paris–Londra, Hamburg–Kopenhag, Napoli–Palermo ve ada bağlantıları gibi örnekler artık görünmez kara kapasitesi sağlamaz; açık köprü, tünel, feribot veya HXD-7.2 deniz zinciri kurulana kadar fiziksel katsayıları `0`dır. Sistem bu geçişleri su üstünden yol uydurarak kapatmaz.

Segment mutasyonu ve kompakt kalıcılık karşı-testlidir: `%60` hasar, `%80` bakım ve `45 sn` onarım kaydı save/load sonrasında birebir korunur. Gerçek Electron kabulünde kaynak `177`, segment `955`, paylaşılan `84`, başarısız fiziksel koridor `12`; su adımı ve geçersiz komşuluk `0` oldu. P95 uzak/orta/yakın/etkileşim `15,8 / 10,2 / 11,4 / 15,6 ms`, şehir hit-test hatası `0 px`, `MAPTEST_PROBLEMS []` ve `MAPTEST_OK` alındı. HXD-7 henüz tamam değildir: deniz segmentleri/feribotlar, bağımsız ray, bakım-iş emri ve segment inşa ekonomisi açık HXD-7.2–7.4 borcudur.

İlk ticaret kabulü `15+ dakika` sonunda zaman aşımına uğradı. Kök neden rota karmaşıklığı değil, her `storyInfrastructureEffectiveCapacity` çağrısının RAM'de hazır segment siciline rağmen dünya/coğrafya/yerleşim/altyapı `ensure` ve doğrulama zincirini yeniden dolaşmasıydı. Kapasite sıcak yolu doğrudan yerleşik sidecar'ı okuyacak şekilde ayrıldı; topoloji mutasyonları sicili zaten açıkça geçersiz kılar. Aynı kapsamlı `tradeProbe` sonrasında `30,4 sn` içinde geçti; altyapı probu `21,3 sn` sürdü. Performans için fiziksel kural gevşetilmedi ve kapalı on iki hayalî kara geçişi tekrar açılmadı.

### HXD-8 — Hiyerarşik ve çok modlu rota motoru

- Makro koridor + mikro segment araması.
- Kapasite rezervasyonu, erişim, maliyet, süre ve güvenilirlik.
- Revision tabanlı hedefli cache invalidation.

**Çıkış:** Aynı durum aynı rota; kırık hat güvenli yeniden planlama.

**Uygulama durumu — HXD-8A çekirdeği tamamlandı:** `StoryRoutePlanner.js`,
LAND/RAIL/SEA koridorlarını `(bölge, son taşıma modu)` durumuyla deterministik
olarak arar; mod değişimini gerçek aktarma maliyeti ve süresi olarak kaydeder.
Seçilen her makro koridor, `StoryHexRoads` sicilindeki sıralı hücre ve fiziksel
segment zincirine açılmadan geçerli rota sayılmaz. Bu özellikle deniz
koridorlarının iki liman erişimini ve su kenarlarını doğru hareket sırasına
çevirir; sicilde kayıtlı fakat fiziksel zinciri kopuk koridor kullanılamaz.

Plan sonucu yalnız toplam skor değildir: koridorlar, taşıma modları, mikro
bacaklar, altıgen hücreleri, segmentler, aktarma bölgeleri, maliyet, gecikme,
güvenilirlik ve darboğaz kapasitesi ayrı alanlardır. Fiziksel bakım/hasar,
makro hasar, erişim hakkı ve daha önce ayrılmış segment kapasitesi seçimden
önce uygulanır. Kapasite rezervasyonu tüm rota segmentlerinde tek işlem olarak
ya kabul edilir ya da hiçbir segmente yazılmaz; süre dolumu ve açık bırakma
save/load içinde korunur.

Önbellek ağ karması, makro hasar revizyonu, fiziksel topoloji/revizyon ve
rezervasyon revizyonuna bağlıdır. Aynı normalleştirilmiş mod kümesi aynı
`routeId` sonucunu verir. Sentetik karşı-testte ray segmenti kapatıldığında
önceki rota terk edilip kara alternatifi seçildi; kapasite taşması atomik
reddedildi ve aktif rezervasyon save/load sonrasında korundu. Canlı kampanya
smoke testinde gerçek bir kara koridoru `6` fiziksel segment ve `7` hücreye
açıldı. Genişletilmiş `test:story-infrastructure` kabul paketi fiziksel
kara/deniz/ray, şirket, geçiş hakkı, ekonomik AI, rota UI ve inşaat dahil
eksiksiz geçti.

**Uygulama durumu — HXD-8B tamamlandı:** cache girdileri kullandıkları bütün
aday koridor ve fiziksel segmentlerle ters indekste bağlanır. Segment hasarı,
makro koridor hasarı, bakım başlangıcı/bitimi, rezervasyon açma/bırakma/süre
dolumu ve fiziksel sicil reset/restore işlemleri aynı invalidasyon kapısına
bağlandı. Böylece ray değişikliği bağımsız LAND cache girdisini korurken yalnız
ray veya çok modlu adayları düşürür. Canlı kampanya karşı-testinde `6`
segmentlik cache rotasının ilk segmenti kapatıldı; `1` hedefli invalidasyon
sonrasında kırık kenarı içermeyen `16` segmentlik alternatif bulundu.

AI rota çağrısı `PERCEIVED` modundaysa `networkView` vermek zorundadır; görünüm
yoksa dünya gerçeğine sessizce düşmek yerine `PERCEPTION_REQUIRED` döner.
Görünüm; gözlemci, kaynak kimliği, gözlem zamanı, son kullanım zamanı, bilgi
durumu ve güven içerir. `VERIFIED` aynen, `ESTIMATED` güven ağırlığıyla,
`RUMOR` ise daha düşük ağırlıkla kullanılır; bilinmeyen hat `CAUTIOUS`,
`ASSUME_NOMINAL` veya `BLOCK_UNKNOWN` politikalarından biriyle değerlendirilir.
Rota çıktısı hangi gözlemlere dayandığını ve hangi segmentlerin belirsiz
olduğunu taşır. Karşı-testte gerçekte kapanmış rayı eski “açık” raporuyla seçen
AI, yeni doğrulanmış kapanma raporundan sonra kara alternatifine geçti; gizli
gerçeği bedava okumadı.

**Açık göç borcu:** `StoryTrade` sevkiyatlarını bu fiziksel rota, bilgi ve
rezervasyon sözleşmesine geçirmek HXD-9'un işidir. Askerî ikmal de aynı
planlayıcıyı kullanacak fakat kendi keşif görünümünü sağlayacaktır; iki tüketici
için ayrı ve çelişkili rota motoru yazılmayacaktır.

### HXD-9 — `ShipmentV2` ve taşıma ajanı çekirdeği

- Mevcut sipariş/lot/ödeme/manifestoyu koruyarak fiziksel hareket ekle.
- Yükleme, hareket, bekleme, yeniden rota, boşaltma ve teslim fişi.
- Uzak toplulaştırma ↔ yakın materyalizasyon eşitliği.
- Haritada yalnız gerçek sevkiyat kaydına bağlı tır/tren/gemi/uçak görünür; dekoratif araç üretilmez.
- Görsel ilerleme simülasyon saatinden ve rota mesafesinden türetilir; render FPS'i konumu değiştiremez.

**Çıkış:** Araç varmadan hedef stok artamaz.

**Uygulama durumu — HXD-9A çekirdeği tamamlandı:** Yeni ticaret sevkiyatı
`StoryRoutePlanner` üzerinden LAND/RAIL/SEA fiziksel rota alır ve stok
düşümünden önce bütün segmentlerde kapasiteyi atomik ayırır. Ödeme ayrılmış
olsa bile fiziksel kapasite ayrılamazsa ödeme serbest bırakılır; stok düşümü,
commerce lot bağlama veya ajan kurma başarısız olursa stok, ödeme ve rota
rezervasyonu birlikte geri alınır.

`StoryTransportAgents.js` her gerçek sevkiyata tek taşıma ajanı bağlar.
`LOADING → MOVING → WAITING → UNLOADING` durumları, sıralı altıgen hücreleri,
fiziksel segment, ilerleme oranı, araç sınıfı, hareket/bekleme süresi ve yük
kimliği aynı kayıttadır. Kara yükü `ROAD_CONVOY`, ray yükü `FREIGHT_TRAIN`,
deniz yükü `CARGO_SHIP` olur. Ajan hem makro koridor erişim/hasarını hem
fiziksel segment bakım/hasarını okur; ikisinden biri kapalıysa ilerleme donar.
Teslim veya kayıpta fiziksel kapasite serbest bırakılır. Yönlendirme eski ve
yeni rezervasyonu atomik değiştirir; yeni rota ayrılamazsa eski kapasite
sessizce kaybedilmez.

Karşı-testte yükleme sonrasında yük iki segmentli rotanın ortasında kaldı,
koridor kapanınca ilerleme `%50`'de dondu, onarımdan sonra son hücreye ulaşıp
boşaltıldı. Aynı `5 sn` hareketi tek tick veya `50 × 0,1 sn` çalıştırmak aynı
sonucu verdi. Canlı kampanyada `5` gıda `7` fiziksel segmentli konvoya bağlandı:
koridor kapalıyken hedef stok `38` kaldı, araç onarımdan sonra varınca `43`
oldu. Geniş altyapı kabul paketi HXD-9 testleriyle birlikte eksiksiz geçti.

**Açık HXD-9B borcu:** eski aktif save sevkiyatlarının kontrollü
`ShipmentV2` göçü, uzak toplulaştırma/yakın materyalizasyon eşitliği, ekran
görüşüne giren gerçek ajanların render projeksiyonu, terminal kuyruğu ve
segment ortasında güvenli alternatif rota gerekir. Araç görselleri bu ajan
sözleşmesinin `vehicleClass`, yön ve LOD ölçülerinden üretilecek; gerçek
sevkiyata bağlı olmayan dekoratif trafik çizilmeyecektir.

**HXD-9B görünürlük dilimi:** Ajan konumu altıgen hücre merkezleri ile segment
ilerleme oranından salt-okunur biçimde türetilir; çizim katmanı simülasyon
durumunu değiştirmez. Yerel zoomda her gerçek sevkiyat ayrı araçtır. Bölgesel
zoomda yalnız aynı araç sınıfı ve hücredeki gerçek sevkiyatlar tek işarette
toplanır; toplulaştırılmış ve materyalize görünümde sevkiyat sayısı ile yük
toplamı değişemez. Harita şimdilik sözleşme doğrulaması için yönlü vektör
tır/tren/gemi silüeti kullanır. Nihai atlas görselleri aynı `vehicleClass`, yön
ve LOD sözleşmesine takılacak; dekoratif taşıt eklenmeyecektir.

Eski aktif kayıt göçü de kontrollüdür: fiziksel ağ ve rota defteri yüklendikten
sonra yalnız gerçek kapasite ayrılabilen eski aktif yükler `ShipmentV2` olur.
Rota veya kapasite bulunamazsa eski yük silinmez, hedef stoğa yazılmaz ve
`deferred` teşhisiyle eski yürütücüde kalır. Başarılı göç yeni başlangıç
bölgesini, rezervasyonu ve göç zamanını sevkiyat üzerinde saklar.

Yoldaki yönlendirme bir aracı segment ortasından başka yere ışınlamaz. İstek
beklemeye alınır; ajan mevcut fiziksel segmentlerini ilk güvenli makro bacak
sınırına kadar tamamlar, o bölgeyi yeni başlangıç kabul eder ve rezervasyonu
orada atomik değiştirir. Başarısız yeni rezervasyon eski kapasiteyi yok etmez.

Terminal yükleme/boşaltma kuyruğu kalıcı FIFO defterine bağlandı. Kara
terminali üç, ray terminali iki, deniz terminali bir eşzamanlı slotla başlar;
kapasite dolunca araç fiziksel başlangıç/varış hücresinde bekler ve bekleme
süresi sevkiyat teşhisine yazılır. Slot yükleme veya boşaltma bitince serbest
kalır. Kuyruk/aktif slot defteri save/load içinde korunur; eski kayıt boş ve
stok üretmeyen terminal defteriyle geri doldurulur.

**HXD-9B tamamlandı:** Modern yüksek çözünürlüklü tır konvoyu, yük treni ve
konteyner gemisi kaynakları `mobile-agents` görsel siciline kaydedildi. Yakın
materyalizasyonda gerçek `ShipmentV2.vehicleClass` bu sprite'ı, fiziksel segment
yönü de dönüşünü belirler. Uzak görünüm yük/sevkiyat toplamını koruyan düşük
maliyetli toplulaştırılmış işareti kullanır. Kaynak yüklenemezse vektör
silüetine kontrollü fallback vardır; sevkiyata bağlı olmayan dekoratif araç
sınıfı katalog tarafından reddedilir. Araç resimleri bir kez decode edilip
mevcut harita atlas havuzunda RAM'de tutulur.

**Sıradaki aktif iş:** HXD-9C 3D sunum karar prototipi. HXD-12 ile kara, ray,
aktarma, liman, gemi, hava ve abluka sözleşmeleri tamamlandığı için 3D denemesi
artık eksik bir taşıma maketini değil kanonik dünyayı okuyabilir. Prototip
fiziksel sevkiyat sözleşmesini yeniden yazmayacaktır.

### HXD-9C — 3D hikâye sunumu karar kapısı

Bu fazın ayrıntılı ve bağlayıcı uygulama planı
`HIKAYE_3D_GECIS_PLANI.md` dosyasındadır. Ana plan faz sırasını, 3D plan ise
renderer sözleşmesini, varlık hattını, bellek bütçesini ve GO/NO-GO kapılarını
yönetir.

Simülasyon 3D motora taşınmayacak; mevcut altıgen, stok, karakter, savaş,
lojistik ve nedensellik defterleri tek otorite kalacaktır. Denenecek şey yalnız
`StoryRender` yerine aynı defterlerden beslenen Three.js/WebGL sunum
adaptörüdür. Böylece 3D denemesi başarısız olsa bile 2D oynanış ve kayıtlar
geri dönüşsüz biçimde kaybedilmez.

İlk dikey yalnız Marmara/Ankara koridorunu kapsar: yükseklikli altıgen arazi,
su, orman, dağ, iki şehir seviyesi, yol/ray, liman ve HXD-9 gerçek taşıma
ajanları. Aynı tür yüzlerce öğe instance edilir; yakın/orta/uzak üç geometri
LOD'u ve atlas/texture-array kullanılır. UI HTML katmanında kalır. Seçim ve
tooltip için 3D raycast sonucu mevcut `mapEntity` sözleşmesine çevrilir.

Kabul kapıları: 1080p hedef makinede kamera hareketinde şehirlerin sonradan
belirmemesi, LLM çalışırken oynanabilir kare süresi, yakın/uzak görünümde aynı
simülasyon kimlikleri, 2D/3D save karşılıklı açılabilirliği ve 10 dakikalık
GPU-bellek kararlılığı. Prototip bu kapıları geçmezse tam 3D üretime girilmez;
mevcut atlas tabanlı 2.5D yol korunur.

Tam Unreal/Unity göçü ayrı bir ürün yeniden yazımı sayılır: Electron UI,
JavaScript simülasyonu, kayıtlar, test tezgâhı ve yerel LLM köprüsü yeniden
bağlanmadan seçilmeyecektir. Öncelikli aday mevcut uygulama içinde WebGL/Three.js
adaptörüdür. Asıl üretim maliyeti motor değil; 2010–2100 dönemlerine ait modüler
3D model, materyal, animasyon, LOD ve görsel kalite kontrol hattıdır. Bin ayrı
tekil model yerine dönem × bölge × işlev parçalarından türeyen modüler katalog
kurulacaktır.

### HXD-10 — Ankara–İstanbul kara yolu dikeyi

- Gerçek depo ve şirketlerle sipariş oluştur.
- Yol rotası, tır/konvoy, hareket, ETA, gecikme ve teslim.
- Yol segmenti kırma, bekleme/alternatif rota ve onarım karşı-testleri.

**Çıkış:** Uçtan uca oynanabilir ve gözlenebilir ilk fiziksel sevkiyat.

**Uygulama dilimi — HXD-10A:** Canlı 2032 dünyasındaki Ankara–İstanbul kara
koridoru sabit bir test maketi olmadan, gerçek bölge stokları, şirket kargosu,
sipariş defteri ve `ShipmentV2` üzerinden uçtan uca kabul testine bağlandı.
Kara konvoyu altı fiziksel segmentte ilerler; hedef şehir bölge görünümü gelen
yükü gösterir fakat araç boşaltmadan stok yazamaz. İlk segment tamamen
kırıldığında ajan o segmentte `HELD / PHYSICAL_SEGMENT_BLOCKED` olur ve gerçek
gecikme biriktirir; onarım sonrası aynı yük terminal kuyruğundan geçerek teslim
edilir. Bu dikey HXD-9 taşıma çekirdeğinin oyuncuya görünen ilk gerçek kullanım
kapısıdır.

**Uygulama dilimi — HXD-10B:** Sağdaki mevcut `BÖLGE` brifingi, oyuncunun
kontrolündeki şehirlerde gerçek lojistik kumandasına dönüştürüldü. Oyuncu hedef
şehri, kanonik bölge stoklarından yükü, miktarı ve otomatik/tır/tren/gemi
taşımasını seçer; emir `storyTradeCreateOrder → storyTradeDispatchOrder`
zincirinden geçmeden araç üretmez. Panel terminal sırası, yükleme, fiziksel
hareket, engelde bekleme, boşaltma, ilerleme ve kalan simülasyon süresini aynı
`ShipmentV2` kaydından gösterir. Başarısız sevk açık emir bırakmaz; `CANCELLED`
olarak hata nedeni ile denetlenebilir kalır. Form taslağı şehir bazında korunur
ve panel güncellenirken odaklanmış miktar/seçim düğümü değiştirilmez; Electron
harita testi bunu ekran görüntüsü ve DOM kimliğiyle karşı-kontrol eder.

**Sıradaki aktif iş:** HXD-11 demir yolu ve aktarma. HXD-10 kara yolu dikeyi
artık motor, gerçek stok/şirket, oyuncu emri, hareketli araç, kesinti/onarım ve
teslim görünürlüğüyle uçtan uca oynanabilir durumdadır.

**Ölçülen render borcu:** HXD-9B Electron harita karşı-testinde taşıma ajanı
katmanı p95 `0,1 ms` kaldı; yeni araç atlası darboğaz değildir. Buna karşılık
toplam p95 uzak/orta/yakında `50,8 / 47,3 / 44,5 ms`, kalıcı harita
katmanlarının tahmini toplamı yaklaşık `995 MiB` ölçüldü. 60 FPS hedefi
geçilmedi. HXD-9C 3D prototipi bu tabanı saklamayacak; şehir, doğal yüzey ve ağ
katmanları için tile/LOD bellek bütçesi ayrı optimizasyon borcudur.
2026-08-20 tarihinde makine savaş AI/LLM yükü altındayken kullanıcı isteğiyle
Electron/FPS kabulü yeniden koşturulmadı; bu yüzden bu borç kapanmış sayılmaz.

### HXD-11 — Demir yolu ve aktarma

- İstasyon, ray, tren, vagon kapasitesi ve zaman penceresi.
- Ankara–İstanbul kara yolu/demir yolu seçimi.
- Tır→tren veya tren→tır aktarması.

**Çıkış:** Süre/maliyet/kapasiteye göre gerçek mod seçimi.

**Uygulama dilimi — HXD-11A:** Ankara–İstanbul canlı 2032 dünyasında kara ve
demir yolu aynı fiziksel rota planlayıcıyla ölçülür; `3,2736 sn` kara yoluna
karşı `2,0642 sn` demir yolu nedeniyle otomatik seçim treni seçer. Demir yolu
emri gerçek `FREIGHT_TRAIN` ajanı üretir. Ray terminalinin iki yükleme yuvası
dolduğunda üçüncü yük `QUEUED` olur ve oyuncu sıra numarasını görür; kırık ray
üç yükü de stok yazmadan bekletir, onarım ve boşaltma sonrası hedef stok tam
miktar kadar artar.

Karma rota artık mod sınırında aracı anında başka sprite'a çeviremez. Yük,
aktarma hücresinde `QUEUED → TRANSFERRING → MOVING` zincirinden, iki taşıma
türünün ortak terminal kapasitesinden ve zaman penceresinden geçer. Tır aktarma
bitmeden yük trenine dönüşmez; planlayıcının aktarma gecikmesi fiziksel ajan
süresine aynen yansır. Sentetik kara→ray testi mod, hücre, terminal anahtarı,
zaman penceresi, araç sınıfı ve teslim korunumunu birlikte doğrular.

**Uygulama dilimi — HXD-11B:** Canlı Bursa→İstanbul→Sofya sevkiyatı kara→ray
karma rotasıdır. Tek `ShipmentV2`, Bursa'dan `ROAD_CONVOY` olarak çıkar,
İstanbul'un fiziksel aktarma hücresinde terminal sırası ve zaman penceresini
öder, ardından `FREIGHT_TRAIN` olarak Sofya'ya gider. Aktarma hedef teslimi
sayılmaz ve stok yazmaz. Ticaret adaptörünün dünya zaman ölçeğiyle uyumsuz
genel `25 sn` cezası, gerçek terminalde ödenen `2 sn` ve `0,1` rota maliyetine
çekildi; böylece karma rota ne bedava ne de yapay biçimde imkânsızdır.

Oyuncu emri öncesinde aynı Bölge paneli seçilecek taşıma zinciri, ETA, maliyet,
fiziksel darboğaz kapasitesi, güvenilirlik ve aktarma sayısını mutasyon yapmadan
önizler. Rota yoksa emir düğmesi kapanır. HXD-11 çıkış ölçütleri canlı kara/ray
seçimi, ray terminal kuyruğu, kırık ray, sentetik deterministik aktarma ve canlı
üç şehirli aktarma testleriyle tamamlandı.

### HXD-12 — Liman ve hareketli gemi

- Liman yükleme/boşaltma, deniz rotası, gemi ve hava/abluka.
- Canlı ağda gerçekten bağlı limanlar arasında fiziksel sevkiyat.
- Sabit dekoratif gemilerin gerçek ajanlarla değiştirilmesi.

**Çıkış:** Gemi hareketi görsel ve mekanik olarak aynı dünya gerçeği.

**Uygulama dilimi — HXD-12A (tamamlandı):** Canlı 2032 fiziksel ağ taraması,
planda kabul örneği yazılan İstanbul–İzmir ve İstanbul–Trabzon çiftlerinin
gerçekte `NO_ROUTE` olduğunu gösterdi. Bu eksikliği gizlemek için sahte koridor
eklenmedi. Oyuncu ülkesinde gerçekten bağlı İzmir–Atina hattı dikey kabul
olarak seçildi; İstanbul'un Ege/Karadeniz bağlantıları dünya-ağı borcu olarak
açık kaldı.

İki `ShipmentV2` aynı İzmir limanından birer gerçek `CARGO_SHIP` üretir. Deniz
terminalinin tek yükleme slotu ilk gemiyi alır, ikinciyi kalıcı FIFO sırasında
tutar. Fırtına koridorun hareket çarpanını düşürür ve kayıp süreyi ayrı
`weatherDelaySeconds` ölçüsünde biriktirir. Abluka stoğu silmez veya gemiyi
ışınlamaz: ajan aynı fiziksel segmentte `HELD / MARITIME_BLOCKADE` olur;
abluka kalkınca aynı yük yoluna devam eder. Atina stoğu ancak liman boşaltması
tamamlandığında iki yükün toplamı kadar artar.

Deniz koşulları sürümlü `maritimeConditions` defterindedir; koridor, hava
çarpanı, ablukacı ülke, gerekçe ve zaman kaydı save/load ile korunur. Bölge
lojistiği rota önizlemesinde abluka/hava uyarısını, canlı yük listesinde
`ABLUKADA BEKLİYOR` veya `HAVA NEDENİYLE BEKLİYOR` nedenini gösterir. Sabit
dekoratif gemi bu katmanda üretilmez; çizilen modern konteyner gemisi gerçek
sevkiyat kimliğine bağlıdır. `story-izmir-atina-sea-vertical.test.js` liman
kuyruğu, hareket, hava, abluka, stok korunumu ve tam kampanya kayıt-yüklemesini
birlikte doğrular.

**Açık borçlar:** Abluka kararını henüz donanma/siyaset AI'si üretmez ve hava
olayı üreticisi bu deftere otomatik yazmaz; bunların sahibi HXD-14/15'tir.
İstanbul–İzmir/Trabzon deniz koridorları, sahte bağlantı eklenmeden yetkili
liman/hat inşasıyla tamamlanmalıdır. Dolu makine nedeniyle sakin-makine 60 FPS
Electron kabulü çalıştırılmadı ve açık performans borcu olarak korunuyor.

### HXD-13 — Teknoloji ve filo/altyapı dönüşümü

- Faz 42 kabiliyet sözleşmesine araç, hat, terminal ve kurulu taban bağla.
- Eski/yeni filo birlikte yaşasın; satın alma, üretim, eğitim ve bakım gerçek olsun.

**Çıkış:** Teknoloji yalnız sayı bonusu değil, gözlenebilir yeni davranış açar.

### HXD-14 — AI, oyuncu eylemleri ve karakterler

- Belediye/şirket/devlet/ordu için aynı proje ve lojistik API'si.
- İsimli karakter; teklif, onay, ihale, anlaşmazlık, gecikme ve onarım kararlarına bağlanır.
- Karakterlerin `TravelItineraryV1` kaydı bulunur: çıkış/varış sitesi, amaç, erişim seviyesi, seçilen rota, araç/konvoy kimliği, kalkış, ETA ve gerçek konum. Karakter toplantıya ışınlanamaz; tır, tren, gemi veya uçakla yaptığı gerçek yolculuk uygun LOD'da görünür.
- Karakterin seyahati aynı kapasite, sınır, hasar ve abluka kurallarına tabidir. Gizli görev yalnız PlayerKnowledge görünürlüğünü değiştirir; fiziksel hareketi iptal etmez.
- UI ham tablo yerine darboğaz ve gerçek eylem gösterir.

**Çıkış:** En az bir AI ve bir oyuncu aynı kurallarla hat kurar veya sevkiyat yönetir.

### HXD-15 — Savaş, kayıt göçü ve tam kabul

- Stratejik ikmal, köprü/liman kesintisi ve savaş hasarı.
- Eski kayıt göçü, bozuk kayıt güvenliği ve kesintisiz save/load.
- 60/300/900 saniye, 30 yıl soak ve gerçek EXE performans kapıları.

**Çıkış:** Yeni altıgen dünya tek kanonik çalışma zamanı olur; eski mutasyon yolu kapatılır.

## 16. Zorunlu kabul matrisi

### Coğrafya

- Şehir merkezi denizde: `0`.
- Limansız deniz bağlantısı: `0`.
- Köprü/tünel/ferry olmadan yasak su/eğim geçişi: `0`.
- Gemi seyredilemez hücrede: `0`.
- Bölgeye atanmamış geçerli kara hücresi: `0` veya açıkça idarî dış alan.

### Korunum

- Sipariş açılması mal üretmez.
- Yükleme kaynak stoğu/ayrılmış lotla mutabıktır.
- Teslim fişi olmadan hedef stok artmaz.
- İptal/kayıp/hasar para ve malı iki kez iade etmez.
- Çok modlu aktarma toplam miktarı değiştirmez.

### Dinamizm

- Nüfus baskısı tek başına bedava şehir büyütmez.
- Bina için arazi, yetki, şirket, iş gücü ve malzeme gerekir.
- Yol/ray inşası segment segment ilerler.
- Hasar kapasiteyi düşürür; onarım gerçek maliyet ve süre ister.
- Teknoloji kurulu taban olmadan bütün dünyaya anlık uygulanmaz.

### Determinizm ve kayıt

- Aynı seed + komutlar aynı grid, rota, araç ve teslim sonucunu verir.
- Yol ortasında kayıt/yükleme, kesintisiz koşuyla aynı konum/ETA/stoğu verir.
- Kamera, zoom ve panel açmak rota veya ekonomi sonucunu değiştirmez.
- Eski kayıt göçü nüfus, stok, şirket, tesis, para ve sahipliği korur.

### Performans

- Seçilen çözünürlük gerçek EXE p95 render bütçesini geçer.
- 900 saniye test mevcut kabul süresini kontrolsüz katlamaz.
- 10.000 sevkiyat stresinde bellek sürekli büyümez.
- Bir segment hasarı bütün rota önbelleğini silmez.

### Oynanabilirlik

- Oyuncu siparişin hangi araçta ve nerede olduğunu görebilir.
- Gecikmenin yol, terminal, kapasite, sınır, hava veya hasar nedeni açıklanır.
- Oyuncu yakın LOD'da gerçek sevkiyat/seyahat taşıtını; uzak LOD'da aynı kayıtların kümelenmiş akışını görür. Görsel araç sayısı ile mekanik ajan sayısı mutabakatlıdır.
- Bir karakter seyahatteyse konumu, ETA'sı ve kullandığı hat kayıt/yükleme sonrasında korunur; varıştan önce hedef şehirde eylem uygulayamaz.
- Oyuncu en az bir hat yapma/onarım/öncelik eylemiyle sonucu değiştirebilir.
- AI aynı eylemi aynı kaynak ve bilgi sınırlarıyla kullanır.

## 17. Bilinçli olarak yapılmayacaklar

- Her sivil otomobili tam dünya ajanı olarak simüle etmek.
- Altıgeni yalnız görsel overlay yapıp eski koordinat fiziğini korumak.
- Şehir büyümesini sprite ölçekleme veya doğrudan `level +1` ile taklit etmek.
- Yol/rayı yalnız çizgi olarak çizip kapasite, inşa, bakım ve hasarı yok saymak.
- Dekoratif gemiyi gerçek sevkiyatmış gibi göstermek.
- Teknolojiyi yalnız küresel yüzde bonusuna indirgemek.
- Altıgen yolları görselde sert merkezden-merkeze zikzak bırakmak.
- Tüm eski kayıtları kıran tek adımlı ve geri dönüşsüz geçiş yapmak.

## 18. İlk uygulanacak iş sırası

Uygulamaya geçildiğinde ilk paket `HXD-0 → HXD-4` olmalıdır. Bunun nedeni araç çizmekten önce coğrafya ve şehir doğruluğunu çözmektir. İlk gerçek oynanabilir dikey ise `HXD-10 Ankara–İstanbul` olacaktır.

Kritik sıra:

1. mevcut sözleşmeleri ve referans sonuçları dondur;
2. grid çözünürlüğünü ölçerek seç;
3. kara/deniz/kıyı topolojisini kur;
4. bütün şehirleri geçerli karaya ve limanları kıyıya göç ettir;
5. render/hit-test'i yeni tek mekânsal kaynağa geçir;
6. fiziksel yol segmenti + rota + sevkiyat + tır dikeyini tamamla;
7. demir yolu ve gemiyi ekle;
8. şehir büyümesi, teknoloji, AI ve savaşı aynı temele bağla;
9. eski mutasyon yolunu ancak tam göç ve kabulden sonra kapat.

Bu sıradan sapıp önce hareketli gemi veya şehir sprite'ı yapmak görsel ilerleme üretir fakat altyapı sorununu çözmez.

## 19. Uygulama kaydı — Civilization tipi hücre sahipliği

Durum: ilk görsel sahiplik dilimi uygulandı.

- Orman, dağ, tarım/kırsal detay, maden ve petrol artık bir `cellId` üzerinden kanonik altıgene yerleşiyor.
- Şehir ve ilçelerin ayırdığı kentsel hücreler doğal içerik üretiminden önce rezerve ediliyor.
- Kara içeriği kıyı hücresine gevşek merkez kontrolüyle değil, `landCoverageBps >= 9400` koşuluyla kabul ediliyor ve son çizim altıgen sınırında kırpılıyor.
- V2'de eski serbest koordinatlı orman/dağ/detay damgaları ve kaynak debug kareleri kapatıldı.
- Şehir çekirdeği için ekran pikseline göre LOD büyütme/küçültme kaldırıldı. Fiziksel sınıf yalnız sabit dünya boyunu seçiyor; görünür boyu sadece kamera zoom'u belirliyor.
- Doğal altıgen içerikleri tek dünya kanvasında önbellekleniyor; her karede binlerce atlas yerleşimi tekrar hesaplanmıyor.

Bu dilim HXD-6'nın görsel/mekânsal temelidir; dinamik tesis inşası, nüfusla yayılan şehir hücreleri, teknolojiye göre değişen yapılar ve fiziksel taşıtlar sonraki sahip fazlarının borcudur.

### HXD-6.1 — Hücre yüzeyi ve kamera önbelleği uygulama kaydı

- Limanlar şehirlerle aynı fiziksel nesne sözleşmesine geçirildi; LOD'a göre boy değiştirmiyor.
- Coğrafya `6000×4720` yüksek çözünürlüklü kanonik dünya yüzeyinde bir kez üretiliyor.
- Altıgenin içinde küçük ikon gösterme yerine zemin ve biyom resmi hücre yüzeyini dolduruyor; gerçek kıyı maskesi son kırpmayı yapıyor.
- Deniz, tekrar eden parlak su karolarına dönüştürülmedi; kesintisiz taban yüzeyi olarak tutuldu.
- Hassas kamera koordinatları pahalı sunum önbelleklerinin anahtarından çıkarıldı. Dört anlamsal zoom bandı ve kaba dünya bölgesi kullanılıyor.
- Kamera etkileşimi sonundaki yeniden uzlaştırma ölçümü `349.4 ms` değerinden `5.9 ms` değerine düştü.

Borç: komşu-altıgen biyom geçişi için altı yönlü autotile/kenar harmanlama atlası gerekir. Yüksek örnekleme çözünürlüğü kaynak atlas çeşitliliği eksikliğini tek başına çözmez.

### HXD-6.2 — Şehir-öncelikli açılış ve 60 FPS kabulü

- Hikâye haritasının sunum döngüsündeki eski `50 ms` / yaklaşık `20 FPS` kilidi kaldırıldı; hedef kare aralığı `1000/60 ms` oldu.
- `6000×4720` doğal altıgen yüzey artık ilk harita karesinde `10.584` hücreyi tek görevde çizmez. En fazla `4 ms` ana iş parçacığı bütçeli `requestAnimationFrame` dilimlerinde üretilir ve yalnız tamamlanınca atomik olarak canlı yüzeyle değiştirilir.
- Yüzey hazırlanırken şehir, etiket, yol ve etkileşim katmanları ilk karede çizilir. Eski tamamlanmış yüzey varsa yeni yüzey hazırlanırken korunur; atlas decode olayı haritayı boşaltmaz.
- `2,2 MB` modern şehir atlası menü/karakter aşamasında yüksek öncelikle yüklenmeye ve asenkron decode edilmeye başlar.
- V2 açıkken her atlasın yüklenmesi milyonlarca piksellik prosedürel arazi tabanını tekrar üretmez. Önceki davranış bir açılışta birden çok tam raster üretip şehir onload olayını ana iş parçacığının arkasında bırakıyordu.
- Politik sınır ve görünür altıgen ızgara katmanları anlamsal zoom bandı + kaba kamera bölgesiyle önbelleğe alındı. Canlı hover ve sahiplik değişimleri anahtara dahil edildi.

Gerçek Electron kabulü (`qa-runtime/map-60fps-city-first-v2/`): uzak/orta/yakın p95 `12,2 / 11,6 / 12,0 ms`; kamera sürükleme+zoom p95 `12,5 ms`; etkileşim-sonu uzlaşma `6,7 ms`; hit-test ortalama/en yüksek hata `0 / 0`; `MAPTEST_PROBLEMS []`. Önceki aynı koşu `21,4 / 23,2 / 20,1 ms` ile yeni `16,7 ms` kapısını geçememişti. Böylece HXD-6.2 içindeki tek-kare ağ/şehir uzlaşma ve 20 FPS döngü borcu kapandı.

### HXD-6.3 — LLM bellek izolasyonu ve gerçek ilk şehir karesi

Savaş AI'sinin sekiz CPU işçisi çalışırken `15,71 GiB` fiziksel belleğin yalnız `4,87–5,85 GiB` kadarı boş kaldı. Yerel 8B host daha önce yaklaşık `4,9 GB` çalışma kümesiyle ölçüldüğü için model + Electron + yüksek çözünürlüklü canvas birleşimi sayfalama sınırına giriyordu. RTX 4060 üzerinde `7956 MiB` VRAM boş olmasına rağmen darboğaz sistem RAM'iydi.

- LLM ayarının açık olması artık menüde, harita girişinde veya karakter AI'sinin on saniyelik tikinde modeli yüklemez.
- Model yalnız gerçek oyuncu sohbeti gerektiğinde başlar; `6,25 GiB` boş RAM yoksa açıklamalı ve yeniden denenebilir deterministik yedeğe düşer.
- En az `8 GiB` boş RAM'de `8192`, daha düşük güvenli aralıkta `4096` bağlam ayrılır. Ayar kapanınca veya beş dakika kullanılmayınca host belleği serbest bırakır.
- İlk harita karesi ayrıntılı prosedürel tabanı senkron üretmez; kanonik rasterdan hızlı taban çizer. Ayrıntılı altıgen yüzey 4 ms hedefiyle arkada hazırlanır. Artık su ve boş hücrelerde kırpma/draw çağrısı yapılmaz; düşük rAF koşulunda işi geciktirmemek için dilim üst sınırı `768` hücredir, zaman bütçesi `24` hücreden sonra her adımda kesme hakkına sahiptir.

Gerçek Electron bellek-baskısı kabulü (`qa-runtime/map-fast-start-memory-gate-final/`): haritaya giriş `4788 ms` değerinden `966 ms` değerine düştü; şehir atlası ve şehir katmanı ilk karede hazırdı; ilk altıgen iş dilimi `0,5 ms`; uzak/orta/yakın p95 `3,9 / 4,6 / 3,8 ms`; etkileşim p95 `5,8 ms`; `MAPTEST_PROBLEMS []`.

### HXD-6.4 — 2010–2100 görsel dil ve varlık manifesti

- Beş sanat dönemi, kurulu teknoloji kademesinden ayrıldı; yıl tek başına yükseltme değildir.
- İlk altı şehir ailesi sürümlü manifestte kayıtlıdır; eksik dönem/durum resmi ölçülebilir fallback borcu üretir.
- Sekiz paket sınıfı, gelecekteki `1.000+` dosyanın tamamının açılışta yüklenmesini engelleyecek yükleme sınırını tanımlar.
- Renderer çekirdek ve ilçe atlas seçimini sicilden alır; mekanik kayıt olmadan fabrika, taşıt, hasar veya yangın resmi gösteremez.

Gerçek Electron kabulünde son manifest çözümleyicisiyle p95 uzak/orta/yakın `10,0 / 10,1 / 7,0 ms`, etkileşim `6,8 ms`; hit-test hatası ve konsol problemi `0` kaldı.

### HXD-6.5 — Fiziksel arazi kullanımı ve tesis sicili (`in_progress`)

Bir altıgene resim yerleştirmek araziyi mekanik olarak kullanılmış saymayacaktır. Önce iki kanonik kayıt kurulacaktır:

- `LandUseCellV1`: hücre, doğal örtü, yasal/aktif kullanım, toprak-su uygunluğu, cevher ve odun stoku, kirlilik, hasar ve bağlı tesis kimlikleri;
- `PhysicalSiteV1`: tesis türü, kapladığı hücreler, sahip/işletmeci, kurulu teknoloji, kapasite, girdiler/çıktılar, inşa-bakım-hasar-terk durumu ve görsel tarif kimliği.

İlk tür sözlüğü `NATURAL / RESIDENTIAL / COMMERCIAL / CIVIC / AGRICULTURE / FORESTRY / EXTRACTION / INDUSTRIAL / ENERGY / LOGISTICS / DEFENSE` olacaktır. Aynı hücrede sınırsız ikon yığılması yasaktır; ana arazi kullanımı ve altyapı/özel tesis yuvaları arazi kapasitesiyle sınırlanır. Orman kesilirse yalnız ağaç resmi kaybolmaz: odun stoğu, erozyon, su tutma, yangın ve karbon durumu değişir. Savaşta yanma/enkaz da yalnız efekt değil, üretim ve geçişe etki eden fiziksel durumdur.

İlk kabul dikeyi, mevcut şirket tesislerinden birini gerçek hücre ve `PhysicalSiteV1` kaydına bağlayacak; tesis atlası yalnız bu kayıt işletimdeyse çizilecektir. Ardından aynı kaydın `CONSTRUCTION → OPERATING → DAMAGED/BURNED → REPAIR` döngüsü kurulacaktır.

İlk salt-okunur dilim `story-hex-land-use-sites-1` ile bağlandı. Mevcut şehir ayak izindeki her çekirdek/ilçe `LandUseCellV1` kaydı alır; uygun `INDUSTRIAL / DEFENSE` hücreleri birer site yuvası taşır. Şirket tesisleri kapasite önceliğiyle yalnız uyumlu ve boş hücreye yerleşir. Aynı altıgende birden fazla tesis yasaktır. Tarım ve çıkarım tesisi şehir hücresine zorlanmaz; kırsal arazi modeli gelene kadar `RURAL_LAND_USE_NOT_IMPLEMENTED` olarak sayılır. Aktif şirket yatırımı tesisi yok etmeden `constructionState: EXPANDING` üretir; kayyum durumu fiziksel yıkım sayılmaz.

İlçe okunabilirliği de fiziksel altıgen oranına bağlandı. Yaklaşık `27,9` dünya birimi genişliğindeki hücrede önceki `10 / 12` birim ilçe görseli tier-2/tier-3 için `16 / 18` birime çıkarıldı. İlçeler hücrenin yaklaşık `%57–65` genişliğini kullanır; `19 / 27` birim şehir çekirdeğinden küçük ve bütün zoomlarda sabit dünya boyutundadır.

Gerçek canlı dünya kabulünde `574 LandUseCellV1`, `124 PhysicalSiteV1` ve `299` açık yerleştirme borcu sayıldı. Borcun `175`i tarım/çıkarım için kırsal arazi modelinin bulunmaması, `124`ü uyumlu şehir hücresinde boş tekil site yuvası kalmamasıdır; toplam `423` şirket tesisi eksiksiz biçimde ya fiziksel siteye ya açık borca hesaplandı. Hücre başına en yüksek tesis sayısı `1`dir. Renderer p95 uzak/orta/yakın `10,3 / 10,7 / 11,8 ms`, etkileşim `12,0 ms`; hit-test hatası ve konsol problemi `0`, sonuç `MAPTEST_OK` oldu. Görsel kabul kareleri `qa-runtime/map-district-sites-hxd65` altındadır.

İkinci salt-okunur dilim `story-hex-natural-resources-1` ile tamamlandı. `10.584` hücrenin kanonik kara/kıyı/dağ verisi ile deterministik doğal örtüsü tek sicile alındı: `3.067 WATER`, `960 COAST`, `3.140 OPEN_LAND`, `1.206 FOREST`, `277 MOUNTAIN`, `1.934 DRYLAND`. Petrol, yalnız `STORY_TERRAIN.oil` kanıtından `15` yatağa; mineral, yalnız `node.mine` bölgesel kanıtından deterministik yerelleştirmeyle `23` yatağa dönüştü. Ekonomide uzman iş gücü/ileri teknoloji havzası olan `18 pts` işaretinin eski renderer tarafından maden sayılması kaldırıldı ve tanıda açıkça reddedildi. Dört kaynak işareti güvenli hücreye çözülemediği için borçta kaldı; rezerv miktarı uydurulmadı (`UNQUANTIFIED_SPATIAL_STOCK_PENDING`).

Çıkarım tesisleri aynı bölgedeki boş petrol/mineral yatağına gerçek `LandUseCellV1 + PhysicalSiteV1` bağıyla yerleşir; yatağı olmayan tesis ikon üretmez. Enerji şirketi petrol kuyusu varsayılmadı. Canlı dünyada kayıt `597` arazi hücresi, `147` fiziksel site ve `276` açık borca ilerledi. Çıkarım borcu kapandı; kalanların `152`si kanonik toprak/ürün uygunluğu bulunmadığı için tarım, `124`ü boş uyumlu şehir yuvası bulunmadığı için sanayi/savunma imar borcudur. Toplam `423` tesis yine eksiksiz hesaplanır, hücre başına en fazla site `1`dir.

Doğal yüzey, boş/su hücrelerinde iş üretmeyen sekiz dilimde tamamlandı: `244` dağ, `1.101` orman, `23` işletilen maden ve `365` seyrek doğal ayrıntı çizildi; işletilmeyen yatak tesis resmi üretmedi. En ağır toplam dilim (son maske dahil) `6,8 ms`, normal iş dilimi `2,1 ms` oldu. Düşük rAF kabulünde toplam hazırlık `4,18 sn` sürdüğü için atomik son-kare değişimi kaldırıldı: merkezden dışarı ilerleyen aynı canvas ilk dilimden itibaren gösterilir, şehir/arayüz katmanı beklemez. Canlı p95 uzak/orta/yakın `6,6 / 5,8 / 6,0 ms`, etkileşim `6,6 ms`; hit-test ve konsol problemi `0`, `MAPTEST_OK`. Kabul kareleri `qa-runtime/map-natural-progressive-final` altındadır.

Kamera sürükleme kabulünde ekran boyutundaki şehir cache'inin yeni kadraja giren alanı içermediği saptandı: eski canvas dönüşümle taşınıyor, fakat yeni şehirler fare bırakılana kadar şeffaf bölgede kalıyordu. Bütün ekran katmanlarını veya tam şehir tarifini her kare yeniden kuran iki deneme sırasıyla `125,8 ms` ve `78,6 ms` p95 ürettiği için reddedildi. Kabul edilen çözüm, cache dışından yeni kadraja giren kanonik şehir çekirdeklerini `urbanModel` koordinatlarından doğrudan bulur; sürükleme boyunca düşük maliyetli pixel şehir LOD'u ve adı çizilir, bırakınca tam şehir/ilçe/tesis canvas'ı kurulur. Uzak-kadro probunda Dublin fare bırakılmadan göründü; canlı LOD en fazla `0,3 ms`, sürükleme p95 `7,9 ms`, maksimum `9,2 ms`, sonuç `MAPTEST_OK`. Kabul kareleri `qa-runtime/map-live-pan-canonical-final` altındadır.

Sonraki HXD-6.5 veri engeli açıktır: hücre bazlı kanonik toprak sınıfı ve nicel orman stoğu yoktur. Hesaplanan `5.039` arable-candidate yalnız aday sıralamasıdır; tarım kurma izni veya gerçek tarla değildir. Bu nedenle `152` tarım tesisi sahte tarlaya çevrilmeyecek. Şehirde yuva bulamayan `124` tesis de aynı hücreye yığılmayacak; yeni sanayi/savunma ilçesi için gerçek imar ve inşaat talebi üretecektir. Sonraki uygulama sırası: toprak/ürün kanıt şeması → tarımsal site yerleştirme → doğal stok ve tüketim → imar talebi/dinamik ilçe genişlemesi.

### HXD-6.6 — Fiziksel imar ve inşaat komutu (`accepted_foundation`)

`story-hex-construction-command-1` ile oyuncu/AI kaynaklı yeni `RESIDENTIAL / INDUSTRIAL / LOGISTICS` inşaatının kalıcı sözleşmesi kuruldu. Hedef hücre ve bölge, arazi edinimi, kurum/yetkili/karar kanıtı, şirket nakit escrow'u, bölgesel malzeme, çakışmayan iş gücü taahhüdü, süre, kapasite, çevre değerlendirmesi ve tamamlanma makbuzu aynı korelasyon zincirindedir. Su, geçilemez dağ, yanlış bölge, dolu arazi ve kaynak yatağına yapı kurulamaz; orman sessizce silinemez. Komut save/load ve hikâye takvimine bağlıdır; başlayan/tamamlanan yapı fiziksel arazi/site siciline girer.

Bu temel, tek başına oynanabilir imar sistemi değildir. HXD-6.7'de oyuncu/AI başvuru yüzeyi kurum eylemine bağlanacak; tamamlanan konut gerçek konut/nüfus kapasitesine, sanayi şirket tesisine ve bölgesel üretime, lojistik HXD-7/HXD-9 ağ kapasitesine devreye alma makbuzuyla aktarılacaktır. Mevcut dokuz yetersiz bölge ancak bedelli kentsel dönüşüm veya coğrafya düzeltmesiyle çözülebilir; yeni sözleşmenin varlığı onları otomatik kapatmaz.

### HXD-6.7 — Yapı devreye alma köprüsü (`accepted_partial`)

Tamamlanma makbuzu artık üç fiziksel kapasite türünü bölgesel sicile yazar. Konut, eski dünya nüfus tavanına makbuz başına ölçülü ek barınma kapasitesi verir. Sanayi, başvuran gerçek şirketin kapalı sektör kataloğuna göre mevcut aynı-sahip tesisi büyütür veya kanonik yeni tesis oluşturur; şirket tesisi ile bölgesel üretim kapasitesi aynı anda kapanır. Lojistik bölgesel terminal kapasitesini kaydeder fakat fiziksel yol segmenti seçilmeden koridor kapasitesini değiştirmez. Escrow, piyasa takası ve kümülatif yatırım muhasebesi tamamlanmadan komut `COMPLETED` olamaz.

HXD-6.7 kısmi kabulün açık tarafı oynanabilir başvuru zinciridir. HXD-6.8; haritada uygun hedef hücre seçimi, oyuncu/ekonomik AI aday üretimi, belediye/imar kurumu yetki kararı, reddetme gerekçesi ve şehir dossier ilerleme görünümünü tek komuta bağlayacaktır. Lojistik kapasitesinin belirli yol/liman segmentine tahsisi HXD-7 ile birlikte yapılır; genel ağ bonusu uydurulmaz.

HXD-6.8'de zincirin yürütülebilir sözleşmesi kuruldu. Oyuncu ve ekonomik AI aynı uygun-hücre sorgusunu kullanır; işgal, su, geçilmez arazi, maden ve açık başvuru çakışmaları daha kurum isteği oluşmadan reddedilir. Geçerli başvuru gerçek `ISSUE_LOCAL_ORDER` kurum kaydına bağlanır. Karar `EXECUTED` olmadan şirket parası, malzeme ve iş gücü bloke edilmez; kurum reddi gerekçesi başvuruda kalır. Uygulanmış karar ancak atomik kaynak rezervasyonu başarılıysa fiziksel inşaat emrine dönüşür ve şehir dossier'i başvuru, ret/kaynak engeli ve inşaat ilerlemesini gösterir.

İkinci dikeyde oyuncu şirketler sekmesinden proje seçer, yakın haritada aynı sorgunun uygun hücrelerini yeşil görür, hedefi tıklayıp sarı işaretler ve başvuruyu gerçek rol/şirket kimliğiyle gönderir. Yalnız `COMPANY_OWNER / COMPANY_EXECUTIVE` kendi kanonik şirketi adına işlem yapabilir. Yerel kurum incelemesi `30` dünya günü sürer ve gerçek makam API'leriyle yürütülür. Ekonomik AI `90` dünya günlük kadansta en fazla bir başvuru üretir; konut için nüfus/konut tavanı, lojistik için çoklu kıtlık, sanayi için kendi sektör kıtlığı kanıtı gerekir. Oyuncunun yönettiği şirket otomasyondan çıkarılır.

Hedefli başvuru, temel inşaat, harita V2 ve altıgen render testleri geçti. İlk iki Electron koşusunda kapanmamış maptest süreçleri GPU cache'i kilitleyip sahte `18–30 ms` p95 üretti; süreç kimliği doğrulanıp yalnız test artıkları kapatıldı. Temiz gerçek Electron kabulünde uzak/orta/yakın/etkileşim p95 `11,9 / 10,3 / 8,5 / 8,4 ms`, hit-test `0 px`, şehir yeniden üretimi `0` ve sonuç `MAPTEST_OK` oldu. İmar taslağının gerçek panel tıklama/görsel kabulü kullanıcı EXE'sinde hâlâ görülmelidir; performans kapısı geçmiştir.

### HXD-6.9 — Görsel üretim dalgası A: 80–150 kanonik varlık

Binlerce dosyaya geçiş HXD-6.8'in fiziksel kimlikleri kararlı hâle geldikten sonra başlar; renderer içine rastgele resim yığılmaz. İlk dalga yaklaşık `80–150` kanonik kaynak üretir: altı şehir ailesi, konut/sanayi/lojistik inşaat aşamaları, temel hasar halleri, liman/karayolu/demiryolu uçları ve iklim varyantları. Her varlık önce `StoryVisualCatalog` manifestine kimlik, çağ, teknoloji kademesi, fiziksel durum, çözünürlük ve fallback zinciriyle girer; ardından atlas üretimi, bellek bütçesi ve üç zoom kabulü yapılır.

İkinci dalga HXD-7 ulaşım segmentleri ve HXD-8 dinamik şehir büyümesiyle `300–500` girdiye çıkar. `2010–2100` teknoloji dönemleri, yapım/işletme/hasar/yıkım durumları ve bölgesel varyantlar tamamlandığında katalog `1.000+` girdiyi aşar. Bu sayı bir hedef kalite kapısıdır: aynı resmi kopyalayarak dosya sayısı şişirmek kabul değildir; her varyantın simülasyonda ayrı bir fiziksel seçilme nedeni olmalıdır.

HXD-6.9 A1 diliminde ilk yeni üretim atlası bağlandı. `urban-construction-atlas-modern-v1.png`, dört gerçek aileyi (`RESIDENTIAL / INDUSTRIAL / LOGISTICS / CIVIC`) dört ayrı yaşam görünümünde (`FOUNDATION / STRUCTURE / OPERATING / DAMAGED`) taşır; toplam `16` farklı hücrenin hiçbiri dosya sayısı şişirmek için kopya değildir. Atlas `1536×1024`, gerçek alfa kanallı ve `2.833.380` bayttır. Katalog artık `22` kayıt taşır: önceki altı modern şehir fallback'i + bu on altı fiziksel inşaat varlığı.

Yeni inşaat sprite'ı soyut yıl değerinden seçilmez. `BUILDING` komutunun `remainingDays / durationDays` oranı temel veya iskelet sütununu; `COMPLETED` işletme sütununu; fiziksel hasar ise hasarlı sütunu seçer. Gelecek dönem atlası yoksa resolver bunu sessizce gelecek resmiymiş gibi göstermez, `PERIOD_ASSET_MISSING` ile modern atlasa açık fallback yapar. Harita yalnız gerçek `sourceConstructionId` taşıyan fiziksel siteyi hedef altıgeninde çizer ve yakın görünümde canlı ilerleme çubuğu gösterir.

Performans borcu da bu dilimde kapatıldı: `remainingDays` statik fiziksel-site kaynak karmasından çıkarıldı. Böylece ilerleme her ekonomi tikinde yaklaşık `906 MB` şehir RAM katmanını yeniden üretmez; canlı sprite doğrudan komuttan okunur, statik katman yalnız `BUILDING → COMPLETED` gibi yapısal durum değişiminde geçersizleşir. İzole maptest profili canlı oyunun GPU cache'inden ayrıldı. Eşzamanlı açık oyun yükündeki son koşuda etkileşim p95 `15,1 ms` ile geçti; uzak/orta/yakın `29,3 / 25,8 / 22,6 ms` kaldığı için A1'in sakin-makine 60 FPS görsel/perf kabulü açık, katalog ve alan testleri geçmiştir. HXD-6.9 tamamlanmış sayılmaz; sıradaki A2 dilimi kalan `58–128` kanonik kaynağın şehir ailesi, iklim ve hasar paketleridir.

HXD-6.9 A2 dilimi ilk dalgayı `86` benzersiz katalog kaydına tamamladı. Dört yeni gerçek alfa atlası eklendi: `urban-climate-atlas-modern-v1.png` (`1536×1024`, `2.696.837` bayt), `urban-damage-atlas-modern-v1.png` (`1254×1254`, `2.523.813` bayt), `special-facilities-atlas-modern-v1.png` (`1536×1024`, `2.866.504` bayt) ve `land-use-atlas-modern-v1.png` (`1254×1254`, `2.349.982` bayt). Her atlas dört aile × dört bağlamsal sütunla `16` kanonik hücre taşır; A2 toplamı `64`, A1 ile yeni üretim toplamı `80`, kontrollü eski fallback'lerle manifest toplamı `86`dır.

Seçiciler görsel rastlantıya bağlı değildir. Şehir çekirdeği/konut/kamusal/sanayi görünümü iklim bölgesinden; hasar atlası fiziksel `DAMAGED / BURNED / ABANDONED` durumundan; lojistik/enerji/maden/savunma görünümü gerçek `PhysicalSiteV1` türünden; tarım/ormancılık/maden/yenilenebilir görünümü ise gerçek arazi kullanımı ve `SETUP / OPERATING / DAMAGED / RECLAIMED` yaşam döngüsünden çözülür. Genel `ENERGY` kaydı yenilenebilir santral sayılmaz; teknoloji/yakıt ailesi açıkça `RENEWABLE` demeden bu resim gösterilmez. Toprak ve ürün kanıtı eksik tarım tesisleri yine yerleştirilmez. Böylece güzel görünmek adına simülasyonda olmayan tarla veya santral uydurulmaz.

Şehir RAM katmanı bütün şehir atlasları decode olmadan kurulmaz; dört atlasın ayrı ayrı hazır olması yaklaşık `906 MB` katmanı dört kez üretmez. Arazi kullanım atlası fiziksel tesis kaynak karmasına katılır ve yalnız ilgili sicil değişince doğal yüzeyi geçersiz kılar. Katalog, V2 harita, altıgen render ve fiziksel site regresyonları geçmiştir. Yüklü makinedeki gerçek Electron koşusunda atlas/şehir katmanı, sürüklerken görünürlük, `0 px` hit-test ve `0` canlı şehir yeniden üretimi işlevsel olarak geçti; fakat CPU `%77`, boş RAM `2,5 GiB` iken uzak/orta/yakın/etkileşim p95 `33,1 / 28,2 / 30,5 / 28,8 ms` oldu. Bu ölçüm 60 FPS kabulü değildir: sakin makine p95 ve oyuncu EXE görsel kontrolü açık kalır. Hasar atlasının `BURNED` sütununda aktif alev/duman dili de “yanmış fakat artık yanmıyor” durumundan fazla canlıdır; sonraki sanat revizyonunda `BURNING` ve `BURNED` ayrılmalıdır.

İlk `80–150` varlık hedefinin alt sınırı aşılmıştır; bundan sonra seçici olmadan kör atlas çoğaltılmaz. Sıradaki sahip faz HXD-7/8'de fiziksel yol/ray/deniz segmentleri, hareketli sevkiyat ve tesis teknolojisi seçicilerini kurar; bu mekanik kimlikler katalogu `300–500` aralığına, 2010–2100 çağ ve durum paketleri de daha sonra `1.000+` gerçek seçilebilir varlığa taşır.
