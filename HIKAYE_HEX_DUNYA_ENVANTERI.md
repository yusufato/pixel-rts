# PIXEL RTS — HXD-0–HXD-3 Dünya Envanteri ve Temel Kabulü

**Tarih:** 16 Ağustos 2026  
**Durum:** HXD-0–HXD-5 kabul edildi; sıradaki aşama HXD-6 dinamik şehir çekirdeği  
**Kaynak:** Gerçek EXE ile aynı script sırasını kullanan `story-sim-harness`

## HXD-0 — Dondurulan mevcut dünya

| Sözleşme | Değer |
|---|---:|
| GEO kaynak boyutu | `1500×1180` |
| Stratejik dünya boyutu | `3000×2360` |
| GEO şehir kaydı | `152` |
| Canlı idarî bölge | `152` |
| Eski görsel yol kaydı | `71` |
| Toplam altyapı koridoru | `591` |
| Kara koridoru | `177` |
| Deniz koridoru | `20` |
| Enerji koridoru | `197` |
| Veri koridoru | `197` |
| Kayıtlı tesis | `423` |
| Depo | `152` |
| Yeni kampanya başlangıç siparişi | `0` |
| Yeni kampanya başlangıç sevkiyatı | `0` |

Bu kimlik ve toplamlar göç mutabakatının başlangıç değeridir. HXD dönüşümü şehir, bölge, tesis, depo, stok, para veya koridoru sessizce kaybedemez ya da çoğaltamaz.

## HXD-1 — Seçilen altıgen temel

| Alan | Kabul edilen değer |
|---|---:|
| Şema | `HexWorldV1` |
| Adaptör | `story-hex-world-1` |
| Koordinat | `POINTY_AXIAL_QR_V1` |
| Yarıçap | `16,1` dünya birimi |
| Satır | `98` |
| Hücre | **`10.584`** |
| Typed-array bellek | `127.796 bayt` |
| Kaynak karması | `fnv1a32:3f310aba` |
| Yerleşim karması | `fnv1a32:1ee6a11a` |
| Runtime ilk kurulum ölçümü | `3,196 ms` |

Karşılaştırılan adaylar:

| Yarıçap | Hücre | Satır | Typed-array bellek |
|---:|---:|---:|---:|
| `20` | `6.873` | `79` | `83.112 bayt` |
| **`16,1`** | **`10.584`** | **`98`** | **`127.796 bayt`** |
| `12` | `19.074` | `132` | `229.948 bayt` |

`16,1` ana aday seçildi. `20` şehir/kıyı ayrıntısı için kaba; `12` ise HXD-2 coğrafya ve sonraki rota maliyeti kanıtlanmadan gereksiz yoğun kabul edildi.

## HXD-1 referans şehir ankrajları

Bu ankrajlar yalnız geometriktir; HXD-2 sonucu aşağıda ayrıca verilir.

| Şehir | GEO | Dünya | Altıgen | Dizi indeksi |
|---|---|---|---|---:|
| Ankara | `1026,1 / 760,2` | `2052,2 / 1520,4` | `hex:42:63` | `6877` |
| İstanbul | `948,8 / 731,9` | `1897,6 / 1463,8` | `hex:38:60` | `6548` |

Ankara ve İstanbul farklı geometrik hücrelere bağlandı. HXD-2, İstanbul'un geometrik hücresinin şehir çekirdeği için geçerli kara olmadığını kanıtladı; bu nedenle HXD-10 başlangıç/varış kimlikleri HXD-4 sürümlü şehir göçü tamamlanınca kilitlenecektir.

## HXD-2 — Fiziksel coğrafya sonucu

| Alan | Sonuç |
|---|---:|
| Şema/adaptör | `story-hex-geography-1` |
| Toplam sınıflandırılan hücre | `10.584` |
| Kara | `6.546` |
| Su | `3.067` |
| Kıyı | `960` |
| Kategorik geçilemez dağ | `11` |
| Dağ koridoruna değen hücre | `640` |
| Nehre değen hücre | `43` |
| Kara erişimli hücre | `7.009` |
| Su erişimli hücre | `3.564` |
| Typed-array bellek | `127.008 bayt` |
| Kaynak karması | `fnv1a32:cdb37056` |
| Coğrafya karması | `fnv1a32:76d987bd` |
| İlk runtime kurulum ölçümü | `109–113 ms` |
| Yükseklik/eğim | `UNAVAILABLE_NO_CANONICAL_SOURCE` |

Her hücre merkez piksel yerine merkez + üç altıgen halka üzerinde toplam `19` sabit örnekle ölçülür. Kara/su/kıyı sınıfı ile altı ortak kenarın kara, su ve kıyı bit maskeleri aynı kanonik rasterdan gelir. Kenarların iki komşuda ters yönlü birebir simetrisi doğrulayıcı kapıdır.

| Şehir | Geometrik sonuç | Çözülmüş kara ankrajı | Sonuç |
|---|---|---|---|
| Ankara | `hex:42:63`, `LAND`, `%100` kara | `hex:42:63` | Yer değiştirmedi |
| İstanbul | `hex:38:60`, `COAST`, `%31,58` kara, yalnız su erişimi | `hex:38:61`, `COAST`, `%89,47` kara | `15,684` dünya birimi kıyı göç adayı |

İstanbul testi eşik düşürülerek veya raster boyanarak geçirilmedi. Geometrik kaynak hücre korunur; çözülmüş şehir çekirdeği en yakın geçilebilir kara+kıyı hücresidir. HXD-4 bu göçü bütün `152` şehir için raporlayıp kalıcılaştıracaktır.

## Kabul edilen teknik kapılar

- Aynı kaynak iki üretimde aynı `10.584` hücreyi ve aynı checksum'u verdi.
- Eksenel koordinat → dünya merkezi → eksenel koordinat round-trip örnekleri birebir geçti.
- Dünya köşesi yalnız gerçekten var olan iki komşuyu döndürdü.
- Bozuk genişlik, yarıçap, hücre sayısı ve layout checksum asset'leri reddedildi.
- Build-time metadata gerçek runtime'da `loadMode: asset` olarak doğrulandı.
- Altıgen sidecar kurulmadan önce ve sonra canlı dünya karması aynı kaldı.
- Gerçek EXE ve test harness kaynak listelerine aynı `StoryHexWorldAsset.js → StoryHexWorld.js` sırası eklendi.
- Bağımsız `story:hex-test` ve paralel `hexWorldProbe` geçti.

## Açık sınır

HXD-2 fiziksel kara/su/kıyı topolojisini kurdu. Henüz:

- bölge → altıgen üyeliği;
- şehirlerin karaya taşınması;
- yol/ray segmenti;
- rota, sevkiyat veya hareketli araç

uygulanmış değildir. Bunları varmış gibi göstermek yasaktır.

Kanonik yükseklik/eğim rasterı ve iç-su (`LAKE/RIVER/SEA/OCEAN`) semantik kaynağı da mevcut değildir. `GEO.ranges` yalnız kategorik dağ koridorudur; metre/eğim gibi sunulamaz.

## HXD-3 kabul hedefi

Mevcut `152` idarî kimliğin korunması, her altıgene kanonik bölge üyeliği verilmesi, sınır/komşuluğun ortak kenarlardan türetilmesi ve nüfus, stok, tesis, şirket, para ve sahiplik toplamlarının birebir mutabakatı kabul hedefiydi. Aşağıdaki HXD-3.1/3.2 sonuçları bu kapıları tamamladı.

## HXD-3.1 ara kabul — üyelik ve fiziksel sınır

| Alan | Sonuç |
|---|---:|
| Şema/adaptör | `story-hex-regions-1` |
| Korunan idarî kimlik | `152/152` |
| Atanmış kara/kıyı hücresi | `7.517` |
| Sahipsiz kara/kıyı hücresi | `0` |
| Bölge başına hücre aralığı | `3–459` |
| Fiziksel sınır kenarı | `2.953` |
| Fiziksel komşu bölge çifti | `362` |
| Eski mantıksal komşu çifti | `177` |
| Ortak çift | `141` |
| Yalnız fiziksel | `221` |
| Yalnız eski mantıksal | `36` |
| Typed-array bellek | `66.667 bayt` |
| Kaynak karması | `fnv1a32:830cb2ec` |
| Üyelik karması | `fnv1a32:542d7b75` |
| İlk runtime kurulum ölçümü | `152,7 ms` |

Üyelik ters dizini CSR (`regionCellOffsets/regionCellIndices`), fiziksel komşuluk ayrı CSR ve her gerçek idarî sınır ortak kenarlı iki hücre kaydı olarak tutulur. Sahipsiz kara, temsil edilmeyen bölge, CSR sayım bozulması, komşuluk asimetrisi, bitişik olmayan sınır ve checksum bozulması doğrulama hatasıdır.

Eski `node.neighbors` fiziksel sınırla aynı kavram değildir. Yeni `362` çiftin eski listenin üstüne yazılması lojistikte hayalî yol açar; eski `177` çiftin fiziksel sınır diye çizilmesi de gerçek sınırların çoğunu siler. İki grafik kalıcı olarak ayrı tutulacaktır.

## HXD-3.2 kabul — politik sahiplik ve ekonomik mutabakat

| Alan | Sonuç |
|---|---:|
| Politik adaptör | `story-hex-political-view-1` |
| Ülke sahibi taşıyan hücre | `7.517` |
| Sahipsiz atanmış hücre | `0` |
| Devlet sınırı ortak kenarı | `460` |
| Politik typed-array bellek | `32.056 bayt` |
| Sahiplik kaynak karması | `fnv1a32:c96e0f19` |
| Sahiplik karması | `fnv1a32:a31ecf84` |
| Mutabakat kaynak/projeksiyon karması | `fnv1a32:3d72d471` / aynı |
| Politik ilk runtime kurulum | `136,561 ms` |

Mutabakat kapsamı yeni kampanya başlangıcında şu gerçek değerleri birebir korudu:

- nüfus kohort toplamı `2.976.000` kişi;
- `8` fiziksel stok türü;
- `48` şirket, `8` banka, `423` tesis, `152` depo;
- şirket nakdi `7.680`, banka rezervi `11.200`, piyasa takas nakdi `72.000`;
- devlet nakdi `16.000`, escrow/borç/para basımı `0`;
- `591` altyapı koridoru (`177 LAND / 20 SEA / 197 ENERGY / 197 DATA`);
- `152` bölgenin canlı ülke sahipliği.

Tesis/depo için geçersiz bölge referansı, eksik nüfus veya bölgesel stok kaydı yoktur. Mevcut yüksek çözünürlüklü politik overlay henüz altıgen şeklinde çizilmez; HXD-5'e kadar aynı sahiplik gerçeğinden geldiğini kanıtlayan `hexMembershipHash/hexOwnershipHash` taşır.

Türetilmiş HXD sidecar'ları save dosyasına yazılmaz. Kayıt/yükleme probunda üyelik, sahiplik ve mutabakat karmaları birebir yeniden üretildi; böylece eski kayıt göçü veya rollback için kalıcı ikinci gerçek kaynağı oluşmadı.

## HXD-4 kabulü — şehir ve liman ankrajları

| Ölçüm | Sonuç |
|---|---:|
| Şehir / benzersiz kara çekirdeği | `152 / 152` |
| Geçersiz geometrik çekirdek / taşınan şehir | `17 / 17` |
| En büyük çekirdek göçü | `32,796` (Beyrut) |
| Denizde veya geçilemez arazide şehir | `0` |
| Liman hizmeti / tekil fiziksel terminal | `59 / 58` |
| Zorunlu deniz koridoru ucu / eksik | `29 / 0` |
| Kaynak geometri fallback'i | `2` (İzmir, Beyrut) |
| Typed-array yükü | `3.648 bayt` |
| Kaynak / yerleşim karması | `fnv1a32:8bc563a0` / `fnv1a32:16e636c9` |

Ankara `hex:42:63` kara çekirdeğinde ve limansızdır. İstanbul `hex:38:61` kara çekirdeği ile komşu `hex:38:60` seyredilebilir su terminaline bağlanır. İzmir'in kendi bölgesinde uygun terminal bulunmadığı için Bursa bölgesindeki `hex:35:62 → hex:36:61` terminaline `101,944` birim mesafeli açık fallback hizmeti vardır. Beyrut da Tel Aviv'in fiziksel terminalini kullanır; iki hizmet tek terminal sicil kaydına bağlıdır. Bu iki vaka kaynak raster borcudur, sessiz sınır değişikliği değildir.

Sidecar canlı dünya durumunu değiştirmedi ve kayıt dosyasına yazılmadı. Bozuk kara çekirdeği, kara olarak verilen liman su ucu, kaldırılmış zorunlu liman ve bozuk checksum ayrı ayrı reddedildi. Kayıt/yükleme sonunda ankrajlar birebir yeniden türetildi.

## HXD-5 kabulü — altıgen render, seçim ve LOD

Kanonik coğrafya, idarî üyelik, sahiplik, şehir çekirdeği ve fiziksel liman terminalleri artık tek altıgen kimlik uzayındadır. İlk HXD-5 dilimi şehir çizimi, kamera, panel odağı, yedek hit-test ve yol uçlarını `storyHexSettlementNodePosition` adaptöründe birleştirdi. Görsel liman ağı da eski rastgele kıyı aramasını bırakıp HXD-4 terminal sicilini ve gerçek 20 deniz bağlantısını tüketiyor.

Politik katman ve doğrudan hücre hit-test'i ikinci dilimde bağlandı. `1640×1290` altıgen canvas `7.517` atanmış hücre, `8` sahip grubu ve `460` tekil devlet sınırı kenarı üretir. Başlangıç render karması `fnv1a32:14f46a5b`; sahiplik değişiminde farklılaşır ve sahiplik geri alındığında birebir döner. Gerçek Electron ilk canvas yapımı `35,1–55,1 ms`, izole headless yapım `6,729 ms`dir. Yakın görünümde altıgen çizgiler `4,2×` LOD sonrasında belirir; örnek viewport culling `506/10.584` hücre dolaştırdı.

Arazi ve hücre görünümü aynı raster/coğrafya karmalarına bağlandı. Gerçek EXE orta görünüm `307` hücreyi (`244` kara / `63` su), yakın görünüm `73` kara hücresini çizdi. İlk profilde `349,9 / 438,7 / 406,0 ms` olan uzak/orta/yakın p95; yoğun sistem yükünde `22,2 / 20,3 / 19,0 ms`, son otomatik kabul koşusunda `7,5 / 7,5 / 6,0 ms` oldu. Her iki sonuç da `33,4 ms` kapısının altındadır; `15` şehir seçiminde hata `0`, konsol problemi `0`dır. HXD-5 kabul edildi.

## Sıradaki aşama — HXD-6

Statik şehir sprite'ı artık çözülmüş altıgen çekirdeğe oturur. Sıradaki iş nüfus, teknoloji, yapılar, arazi uygunluğu ve fiziksel ilçe kapasitesinin şehir ayak izini değiştirdiği dinamik şehir çekirdeğidir; mevcut `level` değeri yalnız geriye dönük uyumluluk görünümü olacaktır.

### HXD-6.1 ara envanter

`story-hex-urban-footprint-1` bağlıdır. `152` şehir `574` benzersiz fiziksel hücre kullanır: `152 CORE`, `196 RESIDENTIAL`, `81 INDUSTRIAL`, `44 CIVIC`, `44 DEFENSE`, `57 LOGISTICS`. Nüfus sicili mevcutken `level` değişimi kaynak/ayak izi karmasını değiştirmez; gerçek bina yatırımı değiştirir ve geri alındığında checksum birebir döner. Sidecar kayıt dosyasına yazılmaz; `2.028 bayt`, `sourceHash fnv1a32:84ac5930`, `footprintHash fnv1a32:4999e71a`.

Beyrut ve Tel Aviv'in idarî bölgeleri fiziksel ilçe kapasitesi bakımından yetersizdir. İstenen `425` ilçenin `422`si yerleşti; eksik `3` ilçe başka bölgeye kaçırılmadı ve açık kaynak borcu olarak tutuldu. HXD-6 henüz tamamlanmadı: sıradaki dikey gerçek konut/lojistik inşa emri, kapasite bedeli ve şehir dossier açıklamasıdır.

### HXD-6.3 fiziksel tesis ve render envanteri

Şehir kompozisyonları kamera hareketinde yeniden üretilmez. İki görsel dünya katmanı (`CORE`, `DISTRICTS`) toplam yaklaşık `56,64 MB` çözülmüş RAM bitmap karosu olarak tutulur; gerçek sürükleme kabulünde üretim seri numarası `1`, tekrar üretim `0` ve kadro dışından gelen şehrin fare bırakılmadan görünmesi doğrulandı.

`423` mevcut şirket tesisinin `262`si benzersiz fiziksel altıgene bağlıdır. Bunların `115`i, hazır ilçe yuvası dolu olduğu için aynı idarî bölgedeki kanonik boş araziye `EXISTING_FACILITY_MIGRATION` kaynağıyla yerleştirildi. `9` sanayi/savunma/enerji tesisi uygun bölge-içi hücre yokluğu, `152` tarım tesisi gerçek toprak/yağış/ürün kanıtı yokluğu nedeniyle açık kaldı. Bu `161` kayıt başka bölgeye taşınmış veya sahte kapasiteyle kapatılmış değildir.

### HXD-6.4 RAM katmanı envanteri

Gerçek Electron `qa-runtime/map-district-port-resolution-final` kabulünde değişmeyen harita resmi RAM dünya karolarına ayrılmıştır: doğal altıgen yüzey `113,28 MB`, 4× ana şehir + 8× seyrek ilçe `1.128.009.728 bayt`, 0,5× yol/deniz yolu `14,16 MB`, ayrı 2× seyrek liman `17.563.648 bayt`, siyasi sınır `7,08 MB`, kıyı `14,16 MB`; toplam `1.294.253.376 bayt / 1234,3 MiB`. İlçe doğrusal çözünürlüğü önceki sürüme göre 2×, liman doğrusal çözünürlüğü 4× arttı; fiziksel dünya boyutları değişmedi. Kamera/zoom boyunca yeniden üretim yoktur. Uzak/orta/yakın/etkileşim p95 yaklaşık `10,3 / 11,1 / 8,4 / 8,4 ms` ile 60 FPS bütçesinin içindedir. Yüksek kalite düşük RAM cihazları için adaptif kademe borcu doğurur.

Okunabilirlik denemesinde koordinat dünyasını ve hücre yarıçapını gerçek 1,5× büyütmek bütün dünya raster alanını 2,25× artırdı ve 60 FPS'i bozdu; bu yol reddedildi. Kabul edilen sunum sözleşmesi 3000×2360 / 10.584 hücreyi korur, minimum kamera yakınlığını 1,5× ve azami zoom'u 5'ten 7,5'e çıkarır. Altıgenler ve içindeki varlıklar ekranda birlikte büyür; veri kimlikleri ve lojistik mesafeleri değişmez. Liman katmanı önceki 2×'ten 4× rastere yükseltilmiştir. Nihai FPS tekrar ölçümü, arka plandaki sekiz yoğun savaş-AI Node işçisi durduğunda yapılacaktır.

RAM'e alma dünya gerçeğini dondurmaz. Sahiplik, geometri, çağ veya ilgili altyapı kaynağı değiştiğinde yalnız etkilenen katman bırakılıp yeniden üretilir. Hareketli taşıt/karakter/ordu ile hover, seçim ve emir işaretleri canlı katmanda kalır; bunların görsel atlası RAM'dedir fakat konumu her kare güncellenir.

### HXD-7.1 altıgen kara yolu envanteri

`story-hex-roads-1`, çizilen `166` kara bağlantısını `987` ortak-kenarlı hücre adımına bağlar. Su/geçilemez hücre ve komşuluk atlaması sıfırdır. Kara zinciri bulunamayan yedi eski GEO kenarı çizimden çıkarılmıştır; bunlar ada/boğaz geçişidir ve deniz, tünel veya köprü koridoru olarak ayrıca sınıflandırılmalıdır. Fiziksel yol segmenti kapasitesi, bakım, hasar, onarım ve taşıt ilerlemesi henüz bu ara kabulün kapsamında değildir.

### HXD-7.2 fiziksel deniz envanteri

`20/20` makro deniz koridoru gerçek liman terminallerine ve sıralı su-altıgen zincirine bağlandı. Sicil `202` deniz segmenti taşır: `29` paylaşılan liman erişimi ve `21` karma kıyı/boğaz darboğazı; fiziksel deniz yolu bulamayan koridor yoktur. Her zincir iki `PORT_ACCESS` ucu taşır ve SEA tabanlı enerji/veri katmanı aynı segment kimliklerini kullanır. Dekoratif liman eğrileri kaldırılmış, RAM ağ katmanı motorun kullandığı `corridorCellPaths` rotasını çizer hale getirilmiştir. HXD-7.1 şema-1 hasar kayıtları şema-2'ye göçebilir. Ray türleri, bakım emri ve yeni segment inşası HXD-7.3–7.4 borcudur; hareket eden gemi/feribot HXD-9'dan önce uydurulmayacaktır.

### HXD-6.6 fiziksel inşaat envanteri

`story-hex-construction-command-1`, yeni konut/sanayi/lojistik yapımını gerçek hedef hücre, arazi kanıtı, kurum kararı, şirket escrow'u, bölgesel malzeme, ayrılmış iş gücü, süre ve çevre bedeline bağlar. Yetki veya kaynak eksikse kayıt `AWAITING_REQUIREMENTS` kalır; LLM ya da şablon onay uyduramaz. Başlayan/tamamlanan komut arazi/site siciline girer, tamamlanma makbuzu save/load içinde korunur. Sonraki envanter borcu bu kapasitenin konut, üretim ve lojistik tüketicilerine devreye alınması ile oyuncu/AI başvuru yüzeyidir.

### HXD-6.7 devreye alınmış kapasite envanteri

Tamamlanan makbuz bölgesel konut, lojistik terminal ve sektör bazlı sanayi kapasitesi üretir. Konut organik nüfus tavanını gerçek kapasite kadar açar; sanayi gerçek şirket tesisi ve `regionalEconomy.sectorCapacity` kaydını birlikte artırır. Şirket escrow'u yatırım gideri ve piyasa takas kaydıyla kapanmadan kapasite oluşmaz. Lojistik kapasitesi kayıtlıdır ancak HXD-7 segmentine tahsis edilmediği için henüz koridor verimini değiştirmez. Açık borç oyuncu/AI başvuru arayüzü, kurum onayı ve dossier ilerleme görünümüdür.
