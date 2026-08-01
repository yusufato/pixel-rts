# Pixel RTS — Modern Dünya Uygunluk ve Eksik Sistemler Defteri

**Amaç:** Her faz ilerlerken çalışan kod ile hedeflenen modern dünya simülasyonu arasındaki farkı kaybetmemek. Bir sistemin dosyada bulunması, modern dünyayı yeterince modellediği anlamına gelmez.

**Durum sınıfları:**

- `fixed`: doğrulanan temel hata kapatıldı.
- `partial`: çalışan bir karşılık var fakat modern dünya davranışı için yetersiz.
- `missing`: mekanik henüz yok.
- `later`: doğru bağımlılık fazı gelmeden güvenli biçimde uygulanamaz.

## Güncel boşluklar

| Kimlik | Alan | Durum | Oyundaki mevcut gerçek | Modern dünya için eksik olan | Hedef faz |
|---|---|---|---|---|---|
| MW-001 | Diplomatik başlangıç | `fixed` | Eski kod eksik her ilişkiyi `war` sayıyordu. | Sekiz devletin 28 ikili kenarı artık `peace` başlıyor; AI/oyuncu/kuşatma yolları düşmanlık kapısından geçiyor. | 17.1 |
| MW-002 | Savaş ilanı | `partial` | Oyuncu barışı açık uyarıyla bozabiliyor; AI yalnız ciddi negatif ilişki, sınır ve şahin doktrinle barışı bozabiliyor. | Casus belli, kriz basamakları, parlamento/kurum onayı, ultimatom, seferberlik süresi, iç/dış meşruiyet ve müttefik yükümlülüğü yok. | 29, 43–49 |
| MW-003 | Devlet gündemi | `partial` | Faz 22 şirket yatırımı ve sınırlı stratejik devlet desteği için gerçek stok/fiyat/bütçe sinyalli karar döngüsü kurdu; askerî olmayan ilk otonom gündem çalışıyor. | Ekonomi, kamu hizmeti, seçim, diplomasi, güvenlik ve kriz yönetimi arasında ortak öncelik seçen ulusal gündem yok. Devlet ekonomik repertuvarı hedefli destekle sınırlı. | 29–31, 46, 55–58 |
| MW-004 | Barış dönemi oynanışı | `partial` | Barışta fiziksel ticaret, gerçek ödeme, şirket/tesis mülkiyeti, banka kredisi, süreli yatırım ve kendi şehirlerinde doğrulanmış stok/fiyat/bütçe/şirket görünümü var. | Oyuncunun bu işlemleri tam çalışma alanında yönettiği ticaret/yatırım akışı, kurum, istihbarat, siyasi kariyer, diplomatik müzakere ve toplumsal kriz hedefleri yok. Şirket sekmesi salt okunur. | 22–46, 60–63 |
| MW-005 | Ticaret ve fiziksel sevkiyat | `partial` | Sipariş, sözleşme, satıcı şirket, rota, kapasite, gecikme, kesinti, yönlendirme, teslimat ve mülkiyet devri gerçek stokla çalışıyor; sınır ötesi bedel teslimatta mal sahibi şirkete geçiyor. | Diplomatik abluka kararı, otomatik kayıp/interdiction, üçüncü ülke transit anlaşması, özel alıcı/akreditif/kur riski ve oyuncu sözleşme çalışma alanı yok. | 22, 43–48, 60.3–61 |
| MW-006 | Fiyat, bütçe ve para | `partial` | Altı fiziksel kalem için 152 fiyat; sekiz devlet bütçesi; 48 şirket ve 8 banka bilançosu var. Faz 23, 1.824 nüfus kohortundan sonlu işgücü türetiyor ve sınırsız dış emek akışını kapatıyor. | Vergi mükellefi/hane karşı hesapları, ücret, kur, mevduat ödeme ağı, tahvil piyasası, merkez bankası davranışı, banka risk fiyatlaması ve kanonik eski-enflasyon köprüsü yok. | 24, 30–33 |
| MW-007 | İç siyaset | `partial` | Fraksiyon, refah, grev ve konsey parçalarına yaş/gelir/meslek/eğitim/kimlik boyutlu nüfus tabanı eklendi. Faz 24 her kohort için fiziksel kaynak erişimi, istihdam güvenliği, güvenlik ve kamu hizmeti sonucu üretiyor. | Sonuçlar henüz şikâyet, sorumluluk atfı, örgütlenme ve oy davranışına bağlanmadı; kurum, seçim, koalisyon, yargı, bürokrasi, yolsuzluk ve barışçıl iktidar devri sistemik değil. | 25–33.1 |
| MW-008 | Karakter derinliği | `partial` | İsimli başkanlar, komutan kişilikleri, üç beceri ve basit eksenler mevcut. | Değer, korku, hırs, kırmızı çizgi, makam hedefi, kişisel çıkar ve eylem adayları tam karakter sistemi değil. | 34–37 |
| MW-009 | Karakter hafızası ve sohbet | `missing` | Şablon konuşmalar ve sınırlı yerel LLM zenginleştirmesi var. | Yönlü ilişki, üç katmanlı hafıza, söz/sır/borç, serbest oyuncu niyeti, tekrar önleme ve dünyaya bağlı müzakere yok. | 35–38.5 |
| MW-010 | Medya ve bilgi | `partial` | Olaylardan üretilen sınırlı haber listesi var. | Kuruluş sahipliği, editoryal çizgi, hedef kitle, söylenti, dezenformasyon, çürütme ve bilgiye göre karar yok. | 39–42 |
| MW-011 | Diplomasi AI | `partial` | Tek ilişki sayısı ve basit ateşkes/pakt/ittifak seçimleri var. | Güven, tehdit, bağımlılık, yükümlülük, taviz, yaptırım, yardım, blöf ve çok hedefli diplomatik planlama yok. | 43–46 |
| MW-012 | Stratejik askerî sınırlar | `partial` | Komutan ordusu, kuşatma, garnizon ve taktik savaşa geçiş var. | Personel/ekipman hazırlığı, gerçek seferberlik, ikmal hattı, savaş hedefi, barış koşulu ve savaş sonrası muhasebe eksik. | 47–52 |
| MW-013 | Dünya çeşitliliği | `partial` | Tohumlu determinizm, ayrı şirket aktörleri, ekonomik karar zinciri ve bölge yapısına göre farklılaşan 1.824 kohort var; aynı gıda/enerji şoku yaş ve gelire göre farklı güçlük üretiyor. | Kohort payları henüz statik; yaşlanma, eğitim, meslek, şikâyet, protesto ve göç geçişleri çalışmadığı için farklı ilk sonuçlar uzun vadeli kelebek etkisine dönüşmüyor. Kurum, karakter, kriz, bilgi ve uluslararası bağımlılık çapraz etkileri de eksik. | 25–58, 64–67 |
| MW-014 | Oyuncu arayüzü | `partial` | Şehir dosyası stok, ticaret, piyasa, `BÜTÇE`, `ŞİRKETLER` ve `NÜFUS` görünümünü bilgi görünürlüğüne göre yayımlıyor. `YAŞAM KOŞULLARI` gıda/enerji/gelir/işsizlik/güvenlik/kamu hizmeti sonucunu gösteriyor; kendi şehrinde doğrulanmış, yabancıda gizli. | Simülasyondan türeyen dünya/şehir/yönetim/ekonomi/diplomasi/karakter/sohbet çalışma alanları henüz tek bilgi mimarisinde birleşmedi; yaşam koşulu göstergeleri neden zinciri, zaman grafiği, karşılaştırma ve karar eylemi sunmuyor. | 25–27, 60–63.1 |
| MW-015 | Fiziksel üretim yeterliliği | `partial` | Faz 22 yatırımları gerçek kapasite üretiyor; Faz 23 işgücünü sonlu kohort arzına bağladı; Faz 24 gerçek hane tahsisinden kaynak erişimini ölçüyor. 900 saniyede gıda `%0`, enerji `%2,70`, yaşam koşulu `%35,19`. | Bu sonuç modern bir denge değil, sistemik çöküş. Sanayi parçası darboğazını, gıda/enerji kıtlığını ve nüfus-talep büyümesini önden gören koordineli yatırım/ithalat/kamu politikası yok; AI sonuçtan politika uyarlamıyor. | 28–33, 55–58 |
| MW-016 | Mali devlet dayanıklılığı | `partial` | AI devleti stratejik şirket desteğini gerçek hazineden öder; şirket bunu ayrı gelir fişiyle alır. 30 yılda şirket borcu `9.196,78`e çıktı, para/bütçe/şirket defterleri geçerli kaldı. | Vergi tabanı, kamu hizmeti zorunlulukları, risk primi, tahvil alıcısı, merkez bankası ve durgunluk kanalı yok; aktif iflas ve devlet temerrüdünün yine `0` olması mali baskının zayıflığını gösteriyor. | 23, 30–33 |
| MW-017 | Şirket ve banka davranışı | `partial` | 48 şirket gerçek stok/fiyat/marj/nakit/borç/girdi sinyalinden aday üretiyor; uygun şirketler kredi alıp süreli yatırım yapıyor ve sonucu kapasite farkıyla kaydediyor. | Bankalar riske göre kredi seçmiyor; rota/kur/jeopolitik risk, hissedar hedefi, yönetişim ve lobi–kurum etkisi yok. Sanayi parçası bitince koordineli üst-akış yatırım planı kurulamıyor. | 28–33, 36–38, 55–58 |
| MW-018 | Demografik geçişler | `partial` | 152 bölgenin nüfusu yaş, gelir, meslek, eğitim ve kimlik boyutlu 1.824 kohortta tam kişi mutabakatıyla tutuluyor; büyüme paylara kayıpsız dağılıyor, fetih siyasi bağı güncelliyor. | Doğum, ölüm, yaşlanma, eğitim tamamlama, iş bulma/kaybetme, sınıf hareketliliği, kimlik değişimi ve göç henüz payları değiştirmiyor. Eski şehir büyümesi 30 yılda nüfusu `7,90 milyon→21,28 milyon` yapıyor; düz kişi artışı modern Avrupa için aşırı ve demografik nedenlere ayrılmıyor. | 25–27 |
| MW-019 | Yaşam koşulu ve toplumsal tepki | `partial` | 1.824 kohort için gıda, enerji, gelir güvenliği, işsizlik riski, fiziksel güvenlik, kamu hizmeti ve birincil baskı hesaplanıyor. Grev ve kuşatma doğru ayrı kanalları düşürüyor; aynı şok farklı kohort ağırlığı üretiyor. | Sonuçlar henüz zaman içinde biriken şikâyet, sorumlu aktör, güven kaybı veya kolektif eylem üretmiyor. Eski devlet refahı `62,25` iken fiziksel yaşam koşulunun `%35,19` olması iki makro göstergenin kopuk olduğunu gösteriyor; güvenli tek yönlü köprü gerekli. | 25–26, 30–33 |

## Faz geçiş kuralı

Her tamamlanan fazda:

1. Bu tabloya yeni gözlenen modern-dünya boşluğu eklenir.
2. Düzeltilen satır `fixed` yapılır; yalnız dosya eklenmesi yeterli sayılmaz.
3. Uzun koşu sonucu modern davranış göstermiyorsa faz teknik olarak geçmiş olsa bile denge/oynanış borcu açık tutulur.
4. Bir sonraki fazın kabul raporu, hangi MW kayıtlarını iyileştirdiğini ve hangilerini bilerek ertelediğini belirtir.
