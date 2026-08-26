# Pixel RTS Hikâye Modu — Oyun Mantığı, Amaç ve İşleyiş

> Durum: yaşayan referans
> Son doğrulama: 25 Ağustos 2026
> Kapsam: çalışan hikâye modu; hedeflenen fakat henüz bağlı olmayan davranışlar
> ayrıca belirtilir
> Denetim ve bug kanıtı:
> [25 Ağustos Sistem Atlası](HIKAYE_MODU_SISTEM_ATLASI.md)

## 1. Bu belge neyi anlatır?

Bu belge “oyun şu anda nasıl çalışıyor?” sorusunun kısa kanonik cevabıdır.
Tarihsel planları veya bütün bug kanıtlarını tekrarlamaz. Bir sistem değiştiğinde
önce kod ve test doğrulanır, sonra bu belge güncellenir.

Her sistem için beş şey açıklanır:

1. Oyundaki amacı.
2. Kanonik veri sahibi.
3. Girdileri ve çalışma sırası.
4. Oyuncunun anlamlı kararları.
5. Ürettiği fiziksel veya kurumsal sonuç.

## 2. Oyun nedir?

Hikâye modu, modern bir devlet ve toplum simülasyonunu taktik RTS savaşlarıyla
birleştiren yaşayan dünya modudur. Oyuncu yalnız haritada orduları hareket ettiren
soyut bir ülke değildir; seçilen rolü, makamı, şirket bağı, hafızası ve ilişkileri
olan bir karakterdir.

Oyunun temel vaadi şudur:

- Dünya oyuncu beklerken donmuş bir dekor değildir; devletler, şirketler,
  karakterler, ekonomi ve toplum ortak saatte ilerler.
- Bir karar ancak gerekli aktör, yetki, kaynak, rota ve kanıt varsa dünyayı
  değiştirmelidir.
- Para, mal, kişi, birlik, makam ve bölge sahipliği kanonik kayıtlarda izlenir.
- Konuşma ve LLM anlatıyı zenginleştirebilir; yoktan fiziksel gerçek üretemez.
- Taktik savaşın sonucu yaşayan dünyaya geri dönmelidir.

Mevcut oyunda açık yenilgi vardır: oyuncunun kontrol ettiği bölge kalmazsa
kampanya sona erer. Açık bir genel zafer veya başarı koşulu bulunmamıştır.
Dolayısıyla mevcut üst amaç, oyuncunun seçtiği rol ve devletle yaşayan dünyada
güç, güvenlik, refah, siyasi etki veya ekonomik başarı kurduğu açık uçlu bir
sandbox'tır. Bunun kalıcı ürün amacı olup olmadığı kullanıcı kararıdır.

## 3. Gerçeklik katmanları

Oyunda aynı bilgi farklı amaçlarla birkaç biçimde bulunabilir. Doğru okuma sırası:

```text
Kanonik dünya ve domain defterleri
  -> doğrulanmış komut
  -> olay / etki / makbuz
  -> WorldV2 görünümü
  -> PlayerKnowledge bilgi filtresi
  -> UI veya karakter konuşması
```

| Katman | Görevi | Yapmaması gereken |
|---|---|---|
| Kanonik defter | Fiziksel ve kurumsal gerçeği tutar | UI metnini gerçek saymak |
| Domain komutu | Yetki, kaynak ve önkoşulu denetler | Aynı eylem için farklı yüzeylerde farklı kural kullanmak |
| Causality/makbuz | Neden, aktör ve değişimi izler | Başarısız niyeti tamamlanmış sonuç gibi göstermek |
| WorldV2 | Canlı dünyayı ayrık ve doğrulanabilir modele çevirir | Canlı nesne referansı sızdırmak |
| PlayerKnowledge | Oyuncunun bildiğini VERIFIED/ESTIMATED/RUMOR/UNKNOWN olarak sınırlar | Yabancı gizli kesin değeri açmak |
| UI/konuşma | İzinli gerçeği anlaşılır gösterir | Ham dünyayı filtreyi atlayarak okumak |
| LLM | Metin, ton ve sınırlı yorum üretir | Para, savaş, makam veya sözleşme sonucu uydurmak |

## 4. Kampanya ana döngüsü

```text
Kurulum
  -> devlet, dünya ayarları ve başlangıç rolü
  -> karakter ve komutan
  -> storyNewCampaign
  -> dünya/kimlik/ekonomi/şirket/kurum/toplum defterleri
  -> harita ve oyuncu bilgi görünümü
  -> sabit adımlı dünya saati
       -> üretim ve gelir
       -> ihtiyaç, kamuoyu ve toplumsal hareket
       -> şirket ve ekonomik AI
       -> karakter kararları ve konuşmalar
       -> diplomasi, savaş ve göç
       -> teknoloji ve çağ
  -> oyuncu kararı veya AI niyeti
  -> yetki / kaynak / rota / kanıt kontrolü
  -> kanonik değişim ve makbuz
  -> bilgi filtreli görünür sonuç
  -> kayıt / yükleme ile aynı dünyaya devam
```

Dünya saati sabit adımlıdır. Oyun sistemleri aynı karede rastgele sırayla
çalıştırılmaz; scheduler görevleri belirli aralıklarla çağırır. Bu ayrım önemlidir:
bir sistemin kanonik alanı değişirken bağımlı görünümün sonraki tikte uzlaşması,
geçici çelişki yaratabilir.

## 5. Dünya, bölge ve harita

### Amaç

Devletlerin nerede egemen olduğunu, hangi bölgelerin komşu olduğunu ve bütün
ekonomik/askerî hareketlerin fiziksel zemini olan dünya topolojisini sağlar.

### Kanonik gerçek

- Bölgenin askerî/siyasi sahibi: `STORY.nodes[].owner`.
- WorldV2 bölge, ülke ve bağlantıları dışa aktarır.
- Hex dünya ve altyapı katmanları şehir düğümlerini gerçek segmentlere bağlar.

### İşleyiş

Bölge sahibi değiştiğinde siyasi harita, telemetri ve şehir adı görünümü
yenilenir. Nüfus, ihtiyaç, kamuoyu, şirket ve bütçe sistemleri bu sahipliği
kendi anlamlarına göre tüketir. Bölge sahipliği “bütün varlıkların ekonomik
mülkiyeti otomatik değişti” anlamına gelmez; özel tesislerin kaderi ayrı ürün
sözleşmesidir.

### Oyuncu kararı

Haritada komutanı komşu bölgeye taşıma, düşman bölgeye saldırma, kendi
bölgesini savunma ve bölgesel yönetim/altyapı kararları.

### Fiziksel hex dünya ve arazi kullanımı

Makro bölge düğümlerinin altında deterministik bir hex fiziksel katmanı vardır:

- `StoryMapRaster` ve `StoryHexGeography` kara, su, kıyı, nehir ve kategorik
  dağ geçişlerini üretir. Gerçek yükseklik veya toprak verisi yoksa uydurmaz.
- `StoryHexRegions` hücreleri 152 idarî bölgeye bağlar; siyasi sahiplik
  görünümünü canlı `node.owner` değerinden türetir.
- `StoryHexSettlements` şehir çekirdeği ve liman terminallerini geçilebilir
  hücrelere ankrajlar.
- Doğal örtü ve yatak sicili yalnız kanıtlı petrol/mineral kaynaklarını kesin
  gerçek sayar. Tarım uygunluğu, toprak ve ürün kanıtı yoksa aday kalır.
- `StoryHexSites` fiziksel tesis yuvasını; `StoryHexConstruction` ise başvuru,
  komut, rezervasyon, süre ve makbuz zincirini tutar.
- Şehir ayak izi ve görsel katalog türetilmiş görünür katmandır; kurulmamış
  fiziksel tesisi yalnız yıl veya teknoloji var diye çizmemelidir.

Bu ayrım “haritada görünen bina”, “bölgenin ekonomik kapasitesi” ve “kanonik
fiziksel tesis” kavramlarının birbirinin yerine kullanılmasını önler.

## 6. Ekonomi, kaynak ve pazar

### Amaç

Savaşın ve devlet yönetiminin gerçek maliyetini üretim, stok, tüketim, fiyat ve
para hareketleriyle kurar.

### Kanonik sahipler

- Bölgesel stok/üretim/talep: `StoryRegionalEconomy`.
- Kaynak kataloğu ve üretim sektörleri: resource/production modülleri.
- Bölgesel fiyatlar: `StoryMarket`.
- Devlet nakdi, escrow, borç ve muhasebe fişleri: `StoryBudget`.
- Fiziksel mal lotu ve mülkiyet: `StoryCommerce`.

### Akış

```text
nüfus + tesis + altyapı + işgücü
  -> üretim teklifi
  -> kaynak ve kapasite kontrolü
  -> bölgesel stok
  -> hane/devlet/şirket talebi
  -> erişim ve kıtlık
  -> fiyat sinyali
  -> şirket veya ekonomik AI kararı
  -> ticaret / yatırım / kredi / politika
```

Oyunda iki ölçek birlikte yaşar:

- Stratejik eski kaynak yüzeyi: petrol, insan gücü ve puan.
- Ayrıntılı bölgesel ekonomi: gıda, enerji, hammaddeler, sanayi parçaları,
  elektronik, askerî malzeme, emek ve sermaye gibi kanonik kaynaklar.

### Oyuncu kararı

Üretim önceliği, stok hedefi, ticaret, yatırım, bütçe, borç, altyapı ve rolün
izin verdiği şirket kararları.

### Sonuç

Stok, fiyat, hane erişimi, şirket bilançosu, devlet bütçesi, refah, işgücü ve
savaş hazırlığı değişir.

## 7. Şirketler, bankalar ve sözleşmeler

### Amaç

Üretim kapasitesini soyut devlet bonusundan çıkarıp mülkiyeti, nakdi, borcu,
tesisi, depoyu ve ticari yükümlülüğü olan ekonomik aktörlere verir.

### Kanonik gerçek

- Şirket ve banka bilançosu: `StoryCompanies`.
- Tesis/depo sahibi: `facility.ownerCompanyId` ve `warehouse.ownerCompanyId`.
- Mal sahipliği: `StoryCommerce`.
- Mekanik sözleşme: `StoryMechanicalContracts`.
- Teslimat ve ödeme: trade + budget + transport defterleri.

### İşleyiş

Şirket üretir, stok/depo kullanır, yatırım projesi açar, bankadan kredi ister,
ticaret yapar ve sıkıntı/iflas durumuna girebilir. Şirket ülkesi ile tesisin
bulunduğu bölgenin güncel siyasi sahibi aynı olmak zorunda değildir.

### Oyuncu kararı

Başlangıç rolüne göre şirket yönetimi, kredi, lobi, yatırım veya başvuru.
“Şirket sahibi” unvanı, kanonik pay defterindeki ekonomik hisse ile aynı şey
değildir; bu ürün sözleşmesi henüz netleştirilmemiştir.

## 8. Devlet bütçesi ve yönetim kapasitesi

### Amaç

Devlet kararlarının yalnız düğmeye basılarak değil, para, kurum, kapasite ve
uygulama süresiyle gerçekleşmesini sağlar.

### Kanonik gerçek

- Devlet hesapları ve fişler: `StoryBudget`.
- Kurumlar ve makamlar: `StoryInstitutions`.
- Uygulama gücü: `StoryStateCapacity`.
- Oyuncu yönetim görünümü ve talepleri: `StoryGovernance`.

### Akış

```text
oyuncu/AI politika niyeti
  -> yetkili kurum ve makam
  -> bütçe ve siyasi/idarî kapasite
  -> talep veya karar kaydı
  -> gecikmeli uygulama
  -> bölge, refah, garnizon, ekonomi veya kurum sonucu
```

### Oyuncu kararı

Rolüne ve tuttuğu makama göre kamu yatırımı, bütçe, seferberlik, atama,
diplomatik temas, seçim ve diğer yönetim eylemleri.

### Takvim ve konsey karar yüzeyi

Bir oyun yılı 120 saniyedir. Konsey iki yılda bir başkentte toplanır; oyuncu
oturumunda dünya durur, AI devletleri aynı gündemi sessiz çözer. Komutanlar
teknoloji, kanun, anayasa, atama, şehir yatırımı ve önergelere kişilikleriyle oy
verir; yönetici çoğunluğu ezebilir fakat sadakat bedeli öder.

Konsey güncel bütçe defterinden puan ödeyebilir; buna karşın bazı eski önergeler
sonucu ayrıntılı domain komutuna göndermek yerine stratejik sayaçları veya şehir
alanlarını doğrudan değiştirir. Bu nedenle “konsey kararı alındı” ile “kanonik
fiziksel yatırım tamamlandı” bugün her gündem maddesinde aynı şey değildir.
Atlas'taki `COUNCIL-01/02` kapanmadan konsey bütün devlet yönetimi için tek
güvenilir yürütme kapısı sayılmamalıdır.

## 9. Siyaset, seçim, kriz ve güç merkezleri

### Amaç

Devleti tek bir “oyuncu ülke” düğmesi olmaktan çıkarıp anayasa, makam, seçim,
çıkar grubu, soruşturma ve krizlerle yönetilen siyasi yapı yapar.

### Kanonik sahipler

- Anayasal kurum ve makam: `StoryInstitutions`.
- Seçimler ve mandat: `StoryElections`.
- Güç merkezleri: `StoryPowerCenters`.
- Bütünlük/soruşturma: `StoryIntegrity`.
- Darbe ve siyasi kriz: `StoryPoliticalCrisis`.
- Karakter kariyer bağı: `StoryCharacters`.

### İşleyiş

Rejim hangi kurumun teklif vereceğini ve hangisinin uygulayacağını belirler.
Seçim mandat üretir; kriz aktör ve sonuç üretir; gerçek iktidar değişimi kurum,
seçim, kariyer ve governance katmanlarında aynı aktörü göstermelidir.

Bütünlük sistemi şu anda kanıt ve bulgu kaydı üretir; kanıtlanmış vakayı
otomatik görevden alma, ceza veya para iadesine bağlamaz. Bu bilinçli faz
sınırıdır.

### Oyuncu kararı

Makam kullanımı, seçim çağrısı, soruşturma dosyası, güç merkezi istişaresi,
istifa ve rejimin izin verdiği yönetim kararları.

## 10. Karakter, kariyer, hafıza ve ilişki

### Amaç

Oyuncu ve AI kararlarının yalnız ülke skorundan değil, kimliği ve geçmişi olan
kişilerden çıkmasını sağlar.

### Kanonik gerçek

- Kimlik, rol, kariyer ve yaşam durumu: `StoryCharacters`.
- Yönlü ilişki eksenleri ve yorum: relationship modülleri.
- Yakın hafıza, bölüm ve kilometre taşı: character memory defterleri.
- Karar adayı ve yürütme: character action/behavior katmanları.

### İşleyiş

Karakterler kişilik, hedef, rol, makam, ilişki, sahip olunan bilgi ve hatırlanan
olaylardan karar adayı üretir. ACTIVE karakter kurumsal eylem kullanabilir;
RETIRED karakterin kişisel ajansı korunabilir; DEAD karakter eyleyemez.

Otomatik yaş, sağlık, doğum tarihi ve mortalite modeli henüz yoktur. Ölüm veya
emeklilik dış kaynak olay kimliği verilen açık transition ile oluşur.

### İlişki, algı ve karar açıklaması

İlişkiler yönlü güven, saygı, korku, borç ve benzeri eksenlerde tutulur; iki
karakterin birbirine bakışı aynı olmak zorunda değildir. Hafıza yakın olay,
özetlenmiş bölüm ve kalıcı kilometre taşı katmanlarına ayrılır. Karar izi ham
dünya gerçeğini değil, aktör adına tutulmuş bilgi/inanç referanslarını, adayları,
yetkiyi, maliyeti ve filtre kapılarını kaydeder.

Karakter aktivasyonu bir ayrıntı bütçesidir: dünya nüfusundan yeni insan
yaratmaz; yalnız olaylarla önemli hâle gelen anonim kohortu yüksek çözünürlüklü
karaktere terfi ettirir. Bu katman ve bölge HOT/WARM/COLD aktivasyonu kamera veya
açık panelden etkilenmemelidir.

## 11. Konuşma, müzakere ve söz

### Amaç

Karakterlerle serbest veya yapılandırılmış konuşmayı, dünya kurallarını atlayan
bir komut satırı olmadan anlamlı karara dönüştürür.

### Güvenli akış

```text
söz
  -> konuşma eylemi ve niyet
  -> bilinen aktör/varlık çözümü
  -> gerekiyorsa açıklama
  -> dünyayı değiştirmeyen inceleme
  -> sürümlü teklif / karşı teklif / taraf kabulü
  -> mekanik preflight
  -> gerçek domain komutu veya sözleşme
  -> teslim / ihlal / ceza / ilişki / hafıza
```

Tarafların anlaşması tek başına dünya sonucu değildir. Kaynak, depo, yetki,
escrow ve gerçek mekanik bağ bulunmadan aday `executable=false` kalır.

Ticari müzakere fiziksel teslimata bağlıdır; tutulmuş söz, ihlal, ceza bekleme
ve yeniden satış sonuçları bulunur. Grev, ihale, seferberlik, yaptırım,
mülteci, banka, esir, boru hattı ve darbe senaryoları şu anda güvenli
`SCENARIO_LAB_ONLY` adaylarıdır; gerçek domain komutuna bağlı değildir.

## 12. Nüfus, ihtiyaç ve demografi

### Amaç

Şehir nüfusunu yalnız tek sayı olmaktan çıkarıp yaş, gelir, meslek, eğitim ve
kimlik profillerine göre ihtiyaç ve işgücü üreten topluma dönüştürür.

### Kanonik sahipler

- Bölge ve ülke kohortları: `StoryPopulation`.
- Gıda, enerji, gelir, güvenlik ve kamu hizmeti sonucu: `StoryNeeds`.
- Fiziksel göç: `StoryHumanMigration`.

### İşleyiş

Her bölgede 12 deterministik profil vardır. Kohort toplamı bölgenin canlı nüfus
sayısıyla tam uyuşur. İhtiyaç sistemi fiziksel erişimi ve profil ağırlığını
birleştirir. İşgücü üretim ve şirket sistemlerine gider.

Göç kaynak kohorttan gerçek kişi düşürür, hedef kohorta ekler ve dünya toplamını
korur. Şikâyet hafızası bugün insanla taşınmaz. Organik şehir büyümesi mevcut
profil paylarını ölçekler; doğum, ölüm, yaşlanma, eğitim veya meslek transition'ı
değildir.

## 13. Kamuoyu, toplumsal hareket ve refah

### Amaç

Ekonomik ve güvenlik sonuçlarını siyasi baskıya ve hatırlanan şikâyete çevirir.

### Akış

```text
stok/erişim + iş + güvenlik + kamu hizmeti
  -> kohort hardship/wellbeing
  -> sorun ve sorumlu aktör atfı
  -> zamanla güçlenen veya sönen şikâyet hafızası
  -> kamuoyu özeti
  -> protesto / grev / radikalleşme
  -> güç merkezi, seçim ve kriz baskısı
```

Kamuoyu kaydı yalnız “memnuniyet puanı” değildir; sorun türü, suçlanan aktör,
etkilenen kişi, şiddet ve bölüm geçmişi taşır.

## 14. Lojistik, altyapı ve ticaret

### Amaç

Malın bir stoktan diğerine anında ışınlanmasını önler; mesafe, mod, kapasite,
terminal, araç ve zaman maliyetini ekonomik kararın parçası yapar.

### Kanonik sahipler

- Sipariş ve sevkiyat: `StoryTrade`.
- Makro koridor: `StoryInfrastructure`.
- Hex rota ve segment kapasitesi: `StoryRoutePlanner`.
- Araç, terminal ve mod transferi: `StoryTransportAgents`.
- Mal lotu: `StoryCommerce`.
- Ödeme escrow'u: `StoryBudget`.

### Akış

```text
satış/sözleşme
  -> kaynak stok ve mal lotu
  -> rota bulma
  -> segment kapasitesi rezervasyonu
  -> yükleme terminali
  -> kara/demir/deniz hareketi ve mod transferi
  -> boşaltma
  -> hedef stok ve yeni mal sahibi
  -> ödeme settlement
```

Hasar rotayı yavaşlatabilir veya durdurabilir. Yönlendirme güvenli ayak sınırında
uygulanır. Göç gerçek rota bulur fakat bugün ticari segment kapasitesini
rezerve etmez.

## 15. Diplomasi, savaş ve fetih

### Amaç

Devletler arası ilişkiyi, antlaşmayı ve askerî egemenlik değişimini ortak
kurallara bağlar.

### Kanonik gerçek

- İlişki ve treaty: `STORY.rel` / `Talks.js`.
- Düşmanlık kararı: `storyIsHostile`.
- Komutan ve kuşatma davranışı: `StoryAI`.
- Taktik savaş köprüsü ve sonuç: `Story.js`.
- Bölge sahibi: `node.owner`.

### İşleyiş

Yeni dünya barışla başlar. Peace, truce, pact ve alliance saldırıyı kapatır;
war açar. AI hedefleme, kuşatma başlangıcı, kuşatma çözümü ve fetih anında
düşmanlığı yeniden denetler. Savaş sırasında barış yapılırsa mevcut kuşatma
sonraki tikte temizlenir.

Oyuncu taktik savaşa kendi komutan ve yakın kuvvet kaynaklarıyla girer. Savaş
sonunda hayatta kalanlar havuza döner, kayıplar birlik havuzundan düşer, fetih
bölge sahibini değiştirir ve refah/itibar/haber sonuçları üretir.

Taktik birlik kaybı bugün doğrudan bölgesel nüfus kohortundan düşmez.

### Askerî üretim ve taktik köprü

Birlikler şehirlerdeki askerî bina seviyesi, teknoloji kilidi, süreli kuyruk ve
komutanın stratejik petrol/insan/puan cüzdanıyla üretilir. Tamamlanan birlik
siparişi veren komutanın sefer ordusuna; komutan kapasitesi doluysa garnizona
gider. Savaşa yalnız bulunduğu şehirdeki komutan ordusu ve savunmada garnizon
katılır; taktik sonuç hayatta kalan tipleri aynı havuza döndürür.

Bu üretim yüzeyi ayrıntılı bölgesel ekonomiyle tam birleşmiş değildir. Stratejik
`oil/manpower/points` harcaması her durumda enerji, askerî malzeme, şirket
tesisi ve nüfus kohortu düşümü üretmez. Dolayısıyla mevcut birlik kuyruğu
oynanabilir askerî gerçek, fakat ayrıntılı ekonomi/demografi açısından açık bir
uyumluluk katmanıdır; birebir fiziksel üretim zinciri sayılmamalıdır.

## 16. Teknoloji ve çağ

### Teknoloji amacı

Devletlerin savaş, üretim, gelir, altyapı ve yönetim kabiliyetlerinde farklı
uzun vadeli doktrinler geliştirmesini sağlar.

Tek ağaçta beş dal ve dört kademe bulunur. Maliyet her araştırmayla artar;
kardeş teknolojiler seçim kilidi yaratabilir. Kademe 1–2 rutin Ar-Ge, Kademe
3–4 konsey kararı olarak tasarlanmıştır. Etkiler teknoloji, kanun ve anayasa
bonuslarıyla birlikte hesaplanır.

### Çağ amacı

Dünyanın savaş, refah, çalkantı, sınır oynaklığı ve teknoloji durumundan
“Kaos”, “Ateş”, “Soğuk Denge”, “Uzun Barış”, “Altın” veya “Gri” çağ türetir.
Çağ hemen titremez; yeni aday belirli farkla ve süreyle önde kalırsa değişir.
Çağ saldırganlık, konuşma ağırlığı, ticaret tonu ve refah sürüklenmesini
geri besler.

## 17. Bilgi sisi, haber ve UI

### Amaç

Oyuncunun bildiği dünya ile motorun bildiği dünyayı ayırır. Stratejik karar,
gizli kesin sayılara otomatik erişime değil; kamu kaydı, kendi idaresi,
istihbarat, tahmin veya söylentiye dayanmalıdır.

### Bilgi sınıfları

- VERIFIED: kaynağı olan kesin bilgi.
- ESTIMATED: yaklaşık fakat kesin alanları kapalı bilgi.
- RUMOR: doğrulanmamış iddia.
- UNKNOWN: değer yok, güven yok.

Haber sistemi fetih, savaş/barış, grev, kıtlık, sermaye kaçışı, darbe, yasa,
çağ ve benzeri önemli olayları yapılandırılmış kayda dönüştürür. LLM varsa
başlığı yeniden yazabilir; olayın mekanik gerçeğini değiştirmez.

UI’nin görevi PlayerKnowledge ve kanonik projeksiyonu göstermektir. Ham STORY
okuyan ekranlar bu sözleşmeyi atlayabilir; bunlar denetim bulgusudur.

### Şehir dosyası, projeksiyon ve gözlem altyapısı

Şehir dosyası kendi bölgelerinde doğrulanmış nüfus, piyasa, lojistik, kurum ve
karakter bilgilerini sekmeli görünümde birleştirir; yabancı kesin bilgi yoksa
sahte sıfır yerine `UNKNOWN` gösterir. Causality projeksiyonu yalnız oyuncunun
görebildiği neden ve etkileri ekrana taşır.

Telemetri dünya matematiğini belirlemez; gerçekleşmiş olayları, kaynak akışını
ve adım süresini sınırlı bir gözlem defterinde tutar. Bölge aktivasyonu
HOT/WARM/COLD çalışma sıklığı üretir. Toplulaştırma modülü HOT→COLD→HOT sırasında
nüfus, stok, kuyruk, şirket ve bekleyen olay toplamlarını koruyan kapsül
sözleşmesidir; güncel motor COLD özetini henüz canlı node yerine çalıştırmaz.

## 18. Kayıt, yükleme ve devamlılık

Kayıt yalnız ekran durumunu değil, dünya saati, scheduler, RNG, causality,
ekonomi, şirket, nüfus, kurum, karakter, ilişki, konuşma, müzakere ve diğer
defterleri taşır. Yükleme sırasında:

1. Şema ve sürüm doğrulanır.
2. Eski kayıt için açık migration/backfill uygulanır.
3. Geçersiz defter güvenli kaynaktan yeniden kurulabilir veya reddedilir.
4. Aynı tohum ve durum aynı geleceği sürdürmelidir.

Bir defterin validatorünün yeşil olması, diğer defterlerle çapraz tutarlı
olduğunu tek başına kanıtlamaz. Makam, para, sahiplik, nüfus ve shipment
yaşam döngüsünde çapraz invariant gerekir.

## 19. Sistemler arası neden-sonuç zincirleri

### Ekonomik kriz

```text
altyapı hasarı
  -> teslimat gecikmesi
  -> stok kıtlığı
  -> fiyat ve erişim bozulması
  -> kohort hardship
  -> kamuoyu şikâyeti
  -> grev/protesto
  -> üretim ve bütçe kaybı
  -> seçim/kriz baskısı
```

### Savaş ve fetih

```text
diplomatik savaş
  -> seferberlik ve ordu havuzu
  -> lojistik ve üretim talebi
  -> taktik/soyut savaş
  -> birlik kaybı ve bölge transferi
  -> nüfus/şirket/vergi yetkisi değişimi
  -> refah, haber ve kamuoyu
  -> göç, seçim ve çağ metriği
```

### Ticari söz

```text
karakter konuşması
  -> teklif ve taraf kabulü
  -> mekanik preflight
  -> escrow ve sözleşme
  -> fiziksel sevkiyat
  -> teslim veya ihlal
  -> para, mal, ilişki ve hafıza
```

### İktidar değişimi

```text
kamuoyu + güç merkezleri + seçim/kriz
  -> mandat veya kriz sonucu
  -> kurum makam geçişi
  -> karakter kariyeri
  -> PlayerAgency yetkileri
  -> bütçe, diplomasi ve devlet kararları
```

## 20. Şu anda model olmayan veya karara bağlı alanlar

Aşağıdakiler çalışan davranışmış gibi kabul edilmemelidir:

- Genel kampanya zafer koşulu.
- Son bölge kaybından gerçek sürgün/dönüş mekaniği.
- Otomatik doğum, ölüm, yaşlanma, sağlık ve karakter mortalitesi.
- Taktik kayıpların nüfus kohortuna birebir bağlanması.
- Tam kredi vadesi, anapara taksiti, temerrüt tahsilatı ve tasfiye zararı.
- Kanıtlanmış yolsuzluk için fiziksel yaptırım.
- Transit koridor sahibi, üçüncü ülke geçiş hakkı ve çalışan transit geliri.
- Göç ve ticari yükün ortak segment kapasitesi.
- Dokuz özel konuşma senaryosunun gerçek domain yürütücüsü.
- Fetihte özel şirket varlıklarının kamulaştırma/kayyım/yabancı mülkiyet politikası.
- Konsey önergelerinin bütçe, nüfus, stok, altyapı ve hex inşaat defterlerine
  atomik domain komutlarıyla bağlanması.
- Stratejik birlik üretiminin ayrıntılı askerî malzeme, tesis, işgücü ve nüfus
  kaynağıyla birebir mutabakatı.

## 21. Belgeyi değiştirme kuralı

Yeni özellik veya düzeltme sonrasında şu dört soru cevaplanmadan bu belge
“güncel” sayılmaz:

1. Kanonik veri sahibi değişti mi?
2. Oyuncu ve AI girişleri aynı domain kapısından geçiyor mu?
3. Para/mal/kişi/yetki/sahiplik korunumu kanıtlandı mı?
4. UI ve konuşma yalnız izinli bilgiyi mi gösteriyor?

Bugların ayrıntılı kanıtı ve karşı hipotezleri bu belgede büyütülmez; Sistem
Atlası, TEST_GAPS, RCA ve LEDGER'a bağlanır.
