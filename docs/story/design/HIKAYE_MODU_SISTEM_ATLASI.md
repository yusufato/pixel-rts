# 25 Ağustos Atlas Operasyonu — Hikâye Modu Sistem Atlası

> Durum: yaşayan çalışma belgesi
> Başlangıç: 25 Ağustos 2026
> Sahip: osman + Codex
> Operasyon adı: **25 Ağustos Atlas Operasyonu**
> Bağlı düzenleme planı: [25 Ağustos Arşiv Düzenlemesi](../../../plans/25-agustos-arsiv-duzenlemesi.md)
> Amaç: hikâye modunun amacını, oyuncu yolculuğunu, kanonik sistemlerini,
> sistemler arası neden-sonuç zincirlerini, açık tasarım kararlarını ve
> doğrulanmış hata bulgularını tek yerde tutmak.

Bu belge bitmiş tasarım ilanı değildir. Kod, test, oynanış gözlemi ve kullanıcı
kararlarıyla bölüm bölüm olgunlaştırılacaktır. Bir iddia kanıtlanmadan
"çalışıyor", bir eksik kullanıcı kararı alınmadan "bug" sayılmaz.

## Operasyon kimliği

**25 Ağustos Atlas Operasyonu**, hikâye modunun baştan sona gerçek çalışma
mantığını yeniden kurar; bugları ve mantık çelişkilerini kanıtlar; ekonomi,
siyaset, şirket, devlet, karakter, lojistik, demografi ve diğer sistemleri aynı
yaşayan atlas içinde ayırır.

Operasyonun belge temizliği kolunun adı **25 Ağustos Arşiv Düzenlemesi**dir.
Bu kol eski görünen dosyaları yaşına veya adına göre taşımaz. Bir kayıt ancak
canlı giriş noktası olmadığı, benzersiz davranış/test kapsamı taşımadığı, yerine
geçen kanonik kaynak belli olduğu ve eski-yeni yol kaydı tutulduğu kanıtlanınca
arşive alınabilir. `LEDGER.md` tarihsel olay kaydı olduğu için bu düzenlemenin
budama kapsamı dışındadır.

## 1. Oyunun mevcut omurgası

Hikâye modu, yaşayan ve deterministik bir modern dünya simülasyonunu taktik
savaş motoruyla birleştirir. Oyuncu bir devlet ve başlangıç rolü seçer; karakter
kararlarıyla dünyaya girer; ekonomi, kurumlar, şirketler, nüfus, lojistik,
karakterler ve diplomasi ortak dünya saatinde ilerler. Oyuncu ve AI, ilke olarak,
aynı fiziksel kaynaklar ile aynı yetki kapılarından geçmelidir. LLM anlatım ve
sınırlı karakter hakemliği yapabilir; mekanik gerçek, sayı veya dünya sonucu
üretemez.

Mevcut ana akış:

```text
Kurulum
  -> devlet / bolluk / doktrin / zorluk seçimi
  -> rol ve karakter yaratımı
  -> storyNewCampaign
  -> kanonik defterlerin bağımlılık sırasıyla kurulması
  -> dünya haritası
  -> sabit adımlı saat + görev zamanlayıcısı
  -> oyuncu veya AI niyeti
  -> yetki / kaynak / rota / kanıt doğrulaması
  -> kanonik dünya değişimi
  -> olay, makbuz, nedensellik ve telemetri
  -> bilgi filtreli UI projeksiyonu
  -> kayıt / yükleme ile devam
```

Taktik savaş ayrı bir dünya değildir. Hikâye modu savaş başlatırken gerçek
komutan, birlik ve kaynak havuzunu taktik motora aktarır; sonuçta hayatta kalanlar,
kayıplar, bölge sahipliği, refah ve itibar yeniden dünya durumuna işlenir.

## 2. Başlangıçta doğrulanan gerçekler

| İddia | Durum | Kanıt | Yorum |
|---|---|---|---|
| Yeni kampanya sistemleri belirli bir bağımlılık sırasıyla kuruyor | Doğrulandı | `js/Story.js:460`, `storyNewCampaign` | Kimlik, şirket, kurum, ilişki, hafıza ve konuşma defterlerinin sırası davranış açısından önemlidir. |
| Dünya sabit adımlı saat ve sürümlü görev siciliyle ilerliyor | Doğrulandı | `js/StoryClock.js`, `js/StoryScheduler.js`, `js/Story.js:1555` | Varsayılan yol özellik bayraklarıyla açıktır. |
| Oyuncu komutları kanonik durumdan olay/makbuz/projeksiyon zincirine bağlanıyor | Kısmen doğrulandı | Mimari sözleşme, `StoryCausality`, hedefli oyuncu-eylemi paketi | Her eylem ailesi ayrı dikey inceleme gerektirir. |
| Lojistik fiziksel rota, taşıt ve teslimat durumuna sahip | Doğrulandı | 20/20 altyapı/lojistik hedefli testi | Tam ekonomi dengesi veya canlı görsel akıcılık bu sonuçtan çıkarılamaz. |
| Dış ticaret gümrük gelirleri gerçek bir ödeyenden tahsil ediliyor | Çürütüldü | tradeProbe mali hareket ayrıştırması ve RCA.md | Satış bedeli dışında escrow ayrılmıyor; ithalat/ihracat gelirleri karşılıksız kredi. Transit dalı ise kanonik koridorlarda çalışmıyor. |
| Kampanyada oyuncu için yenilgi koşulu var | Doğrulandı | `js/StoryAI.js:129-139` | Oyuncunun sıfır bölgesi kaldığında kampanya biter. |
| Kampanyada açık bir zafer/başarı sonu var | Bulunamadı | `_gameOver` ve kampanya bitişi taraması | Bu henüz bug değildir. Sonsuz sandbox mı, hedefli kampanya mı istendiği kullanıcı kararı gerektirir. |
| 24 Ağustos günlüğündeki 0,5 saniyelik lojistik görevi bugün de geçerli | Çürütüldü | Git geçmişi ve `StoryScheduler.js:15` | Aynı gün sonraki performans değişikliği lojistik görevini önce 2, sonra 10 saniyeye çıkarmıştır. Günlük tarihsel anı doğru, güncel sözleşme değildir. |

Başlangıç doğrulama komutları:

```text
npm run test:story-player-agency      -> 18/18 geçti
npm run test:story-infrastructure     -> 20/20 geçti
npm run test:story:plan               -> 88 görev, bu makinede 2 işçi planlandı
```

Bu sonuçlar tam paket, uzun süreli denge, gerçek Electron görsel kabulü veya
oyuncu deneyimi kanıtı değildir.

## 2.1. Aşama 1 yaşam döngüsü — ilk denetim sonucu

```text
Yeni kampanya
  -> dünya ve defterler kurulur
  -> dünya adımları ilerler
  -> saldırı/savunma için gerçek havuzlar taktik savaşa aktarılır
  -> sonuç dünyaya yazılır
  -> sonuç UI'si ödül seçtirir
  -> dünyaya dönüş
  -> sıfır bölge kontrolü
  -> yenilgi ekranı
```

Tam paket 88 görev planladı fakat 85/88'de durdu. Duran
`characterActivationBudgetProbe` gerçek oyun sırası hatası değildir: görev
sicilindeki kayıt sırasını callback yürütme sırası sanan bayat bir assertiondır.
Gerçek çağrı sırası hâlâ `behavior -> activation -> actions` biçimindedir. Bu
bulgu ve çürütülen hipotezler `RCA.md` içinde kayıtlıdır.

Yaşam döngüsünde doğrulanan oyuncu-etkili bulgular:

| Kimlik | Bulgu | Önem | Güven | Durum |
|---|---|---|---|---|
| LIFE-01 | Kayıp ve beraberlik de zaferle aynı ödül kartlarını talep edebiliyor | High | Confirmed | Düzeltme kararı bekliyor |
| LIFE-02 | Son bölge kaybında “geri alarak toparlan” mesajından sonra kampanya hemen yeniliyor | Medium | Confirmed | Tasarım kararı bekliyor |
| LIFE-03 | Sonuç ekranındaki bekleyen ödül kayda giriyor, fakat devam akışı bu ekranı yeniden açmıyor | Medium | Confirmed | UX sözleşmesi bekliyor |
| LIFE-04 | Geçersiz savaş hedefi null guard'dan önce dereference ediliyor | Low | Confirmed | Bugfix adayı |
| TEST-01 | Tam sim harness savaş girişini ve gerçek yenilgi kontrolünü stub'lıyor | High | Confirmed | Test boşluğu |
| TEST-02 | Karakter aktivasyon probu metadata sırasını runtime sırası sanıyor | Medium | Confirmed | Test bugı |

LIFE-01 doğrudan runtime tekrarında loss, draw ve win sonuçlarıyla sınandı.
Kayıp ve beraberlikte `logistics` ödülü talep edilebildi; petrol +150, insan gücü
net +120 ve puan +150 arttı. Bu nedenle konu yalnız metin/UI tutarsızlığı değil,
savaş riskini tersine çevirebilen ekonomik istismardır.

## 2.2. Aşama 2 ekonomi/şirket/lojistik — ilk denetim sonucu

İzole bölgesel ekonomi, ticaret, piyasa, bütçe, şirket, birim ekonomisi,
satış/teslimat, dağıtım ve ekonomik AI probları geçti. Ekonomik AI koşusunda dört
döngüde 220 karar, 7 başlatılan proje, 6 kredi ve 6 gerçekleşen sonuç üretildi;
oyuncu devleti adına özerk karar sayısı sıfır kaldı ve save/load defteri birebir
korundu. Bunlar sistemlerin çalıştığını gösterir, para ve mal korunumunu tek başına
kanıtlamaz.

| Kimlik | Bulgu | Önem | Güven | Durum |
|---|---|---|---|---|
| ECON-01 | İthalat vergisi ve ihracat harcı ödeyen aktörden düşülmeden devlet kasasına yazılıyor | High | Confirmed | Tahsilat sözleşmesi kararı bekliyor |
| TEST-03 | Mevcut tradeProbe satış escrow'unu doğruluyor fakat vergi ödeyenini ve toplam para korunumunu ölçmüyor | High | Confirmed | Test boşluğu |
| RECORD-01 | LEDGER'da geçtiği söylenen test_customs_and_foreign_trade.js güncel depoda veya git geçmişinde yok | Medium | Confirmed | Eski/geçersiz kayıt adayı; tarihsel kayıt silinmeden düzeltme kaydı eklendi |

ECON-01'in deterministik örneğinde 3 satış bedeli tam olarak satıcı şirkete
aktarılırken 1,26 kargo değeri üzerinden alıcı devlet 0,1512 ve satıcı devlet
0,063 kazandı. Ekonomi toplamı tek teslimatta 0,2142 arttı. Transit yüzde 2 dalı
`corridor.ownerCountryId` okuyor; kanonik koridorlar bu alanı üretmediği için
fiilen çalışmıyor. Bu ayrım lojistik dikeyinde LOG-03 olarak düzeltildi.

## 2.3. Aşama 3 siyaset/devlet — ilk denetim sonucu

Güç merkezi, kurum, devlet kapasitesi, seçim, bütünlük, siyasi kriz ve yönetim
probları izole olarak 1/1 geçti. Seçim probu sekiz ülke için 8 sertifikalı seçim,
8 devir, 2.799.424 uygun kişi ve 2.017.434 kullanılan oy üretti. Yönetim probu
120 puan maliyeti, kurum onayı, tamamlanan uygulama bileti ve şehir seviyesinin
2'den 3'e fiziksel değişimini gösterdi. Bu sonuçlar tekil defterleri kanıtlar;
oynanabilir rol ile seçim arasındaki çapraz sahipliği kanıtlamaz.

| Kimlik | Bulgu | Önem | Güven | Durum |
|---|---|---|---|---|
| POL-01 | EXECUTIVE oyuncu seçimi kaybetse bile kurum ve yönetim yetkisinde Cumhurbaşkanı kalıyor | High | Confirmed | Kariyer/seçim sözleşmesi kararı bekliyor |
| POL-02 | EXECUTIVE kampanyası ilk tikten itibaren seçim defteri ve kurum defterinde iki farklı yürütme sahibi taşıyor | High | Confirmed | POL-01 ile aynı kök sahiplik düzeltmesi |
| TEST-04 | electionProbe varsayılan COMMANDER rolüyle çalışıp EXECUTIVE makam devrini sınamıyor | High | Confirmed | Test boşluğu |
| UI-01 | Governance görünüm cache'i var olmayan institution revision alanına bağlı; makam değişiminde eski rolü gösterebiliyor | Medium | Confirmed | Ayrı bugfix adayı |
| TEST-05 | governanceProbe yanlış GENELKURMAY rolü ve holdsExecutive=false sonucuyla yeşil geçiyor | Medium | Confirmed | Assertion sözleşmesi eksik |
| POL-03 | Başarılı darbe kriz liderini yürütme makamına geçirmiyor; kurum katmanı eski seçim sahibini koruyor | High | Confirmed | Tek yürütme transition sözleşmesi gerekli |
| TEST-06 | politicalCrisisProbe darbe sonucunu doğruluyor fakat kriz lideri ile kurum makam sahibini eşitlemiyor | High | Confirmed | Çapraz-defter testi eksik |
| GAP-01 | Kanıtlanmış bütünlük vakası kayıt ve kriz-risk girdisi üretir; ceza, görevden alma, iade veya şirket yaptırımı üretmez | Medium | Confirmed phase boundary | Yaptırım tasarımı/uygulaması bekliyor |

Deterministik EXECUTIVE tekrarında 10. saniyede seçim defteri Demir Aydoğan'ı,
kurum defteri oyuncuyu; 420. saniyedeki sertifikalı seçimden sonra seçim defteri
Bora Demirel'i, kurum defteri yine oyuncuyu yürütme sahibi gösterdi. Yönetim UI'si
oyuncuya Cumhurbaşkanı yetkisi vermeyi sürdürdü. Ayrıntılı kök neden, çürütülen
hipotezler ve düzeltme seçenekleri RCA.md içindedir.

Governance cache tekrarında makam değişiminden önce ve sonra cache anahtarı
`country:0|character:0:0|0|0|||` olarak aynı kaldı; kurum defterinde kullanılan
`revision` alanı yoktu. Cache temizlendiğinde görünüm aynı durumda
`CUMHURBAŞKANI` ve `holdsExecutive=true` değerlerine döndü. Eylem görünümü ayrı,
önbelleksiz hesaplandığı için panel etiketi ile izin kısa süreli ayrışabiliyor.

Bütünlük sistemi gerçek kurum isteği, bütçe fişi, şirket ve kanıt kimliği
gerektirir. Deterministik prob iki vaka ve beş kanıt üretti; açık rüşvet vakası
6.321/10.000 skorla `SUBSTANTIATED`, şüpheli ihale 4.271/10.000 skorla
`UNSUBSTANTIATED` oldu. Ancak politika açıkça
`INTEGRITY_FINDING_RECORD_ONLY_PHASE_32` ve `physicalMutation=false` der. Bulgu
siyasi kriz riskine girdi olur; doğrudan yaptırım halkası henüz yoktur.

Siyasi kriz hazırlık, koalisyon ve karşı-hamle skorlarından deterministik sonuç
çıkarır; oyuncu eylemleri komuta puanı/itibar tüketir, hafıza ve ilişki olayları
üretir. Başarılı darbe refahı ve komplocu sadakatini değiştirip legacy
`state.gov.crisisActorId` alanını yazar; bölge sahipliğini bilinçli olarak
değiştirmez. Doğrudan başarı tekrarında kriz lideri `character:0:1` iken kurum
yürütme sahibi `character:0:president` Demir Aydoğan kaldı ve kurum validatorü
çelişkiye rağmen geçti. Son kök neden RCA.md içindedir.

## 2.4. Şirket–karakter sahiplik dikeyi — ilk denetim sonucu

Şirket defteri her ülke ve sektör için tüzel kişi, yüzde 100'e tamamlanan pay
listesi, dengeli hesaplar, banka, tesis, depo ve yatırım projeleri kurar. Üretim
fiziksel girdiyi ve şirket nakdini; satış sahipli envanteri ve fatura akışını;
kredi ise şirket nakit/borcunu ve banka rezerv/alacağını birlikte değiştirir.
Yatırım önce nakit ile parçaları bloke/tüketir, dünya günü tamamlanınca kapasite
artar. Nakit yokluğu ve borç 90 dünya gününde `INSOLVENT`, 180 günde
`BANKRUPT/DISSOLVED/REVOKED` ve tesislerde `RECEIVERSHIP` üretir.

Karakter tarafında oyuncu `COMPANY_OWNER` seçilince
`company:0:civil_industry` kuruluşuna bağlanır ve Yönetim Kurulu Başkanı unvanı
alır. Aynı kuruluş için ayrı bir isimli `COMPANY_EXECUTIVE` CEO üretilir; CFO ve
CTO makamları boş bırakılır. Ancak bu makamlar şirket defterinde saklanan bir
kurul sicili değil, karakter rolü + `organizationId` bağından türetilen salt
okunur projeksiyondur.

| Kimlik | Bulgu | Önem | Güven | Durum |
|---|---|---|---|---|
| COMP-01 | `COMPANY_OWNER` oyuncu şirketi yönetiyor fakat kanonik pay defterinde hissesi %0 | High | Confirmed | Sahip mi profesyonel yönetici mi ürün kararı gerekli |
| COMP-02 | Aynı kredi kurul yolunda CFO eksikliğiyle kilitlenirken PlayerAgency doğrudan kredi mutasyonu yapıyor | High | Confirmed | Tek kredi yetki hattı gerekli |
| COMP-03 | `BANKRUPT/DISSOLVED/REVOKED` şirket PlayerAgency üzerinden yeni kredi çekebiliyor | High | Confirmed | Yaşam döngüsü kapısı eksik |
| TEST-07 | Şirket ve rol-adaptörü probları kurul teklifini ve doğrudan krediyi ayrı ayrı yeşil sayıp çelişkiyi karşılaştırmıyor | High | Confirmed | Çapraz-yol testi eksik |
| TEST-08 | Şirket probu iflas üretmiyor ve iflas sonrası eylemleri sınamıyor | High | Confirmed | Yaşam döngüsü testi eksik |
| GAP-02 | Kredi kimliği, vade, anapara geri ödemesi, temerrüt tahsilatı ve tasfiye zararı yok; yalnız toplam borç/alacak ve faiz var | Medium | Confirmed phase gap | Banka/kredi yaşam döngüsü tasarımı gerekli |
| GAP-03 | Yönetim karar kuyruğu `BOARD_APPROVAL_MISSING` teklifleri üretir; şirket kurul onayı/ret/yürütme API'si yok | Medium | Confirmed phase gap | Kurul karar yaşam döngüsü gerekli |

Deterministik aynı-aktör tekrarında kurul yolu kredi için CEO, CFO ve Yönetim
Kurulu Başkanı istedi; CEO ve başkan dolu, CFO boş olduğu için teklif
`BOARD_APPROVAL_MISSING` ve ekonomik olarak etkisiz kaldı. Aynı oyuncu hemen
PlayerAgency yoluyla 75 kredi çekti: şirket nakdi 160→235, borç 0→−75, banka
rezervi 1.400→1.325 oldu. İkinci tekrarda şirket 182,5 sıkıntı gününde hukuken
feshedilip 12 tesisi kayyıma geçti; buna rağmen yeni 10 krediyle nakit 0→10 ve
borç −77,4375→−87,4375 değişti. Her iki durumda şirket validatorü geçti. Güncel
kök neden ve çözüm seçenekleri RCA.md içindedir.

## 2.5. Karakter yaşam döngüsü — ilk denetim sonucu

Karakter katmanı kimlik, kişilik eksenleri, değer/hedef, yönlü ilişki, yakın ve
uzun süreli hafıza, kariyer makamları, eylem makbuzları ve konuşma bağlamını aynı
aktör kimliği altında tutar. İstifa makam yetkisini kaldırırken kişilik,
ilişkiler ve önceki hafızayı korur. Emeklilik kurumsal yetkiyi kapatıp yalnız
kişisel ilişki eylemlerini bırakır; ölüm normal karakter eylemlerini ve türetilmiş
şirket makamını kapatır. Kohorttan isimli temsilci terfisi nüfus toplamını
değiştirmeden deterministik kimlik ve köken hafızası üretir.

Hedefli hafıza ve eylem probları geçerli defter, gerçek ilişki/maliyet etkisi ve
birebir save/load gösterdi. Kariyer probunun 9/9, yaşam durumu probunun 12/12,
kohort terfi probunun 14/14 alanı doğru sonuçlandı. Bu güçlü tek-domain kanıtı,
PlayerAgency entegrasyonunu kapsamıyor.

| Kimlik | Bulgu | Önem | Güven | Durum |
|---|---|---|---|---|
| CHAR-01 | Ölü veya emekli oyuncu PlayerAgency üzerinden şirket kredisi ve lobi yapabiliyor | High | Confirmed | Merkezi yaşam kapısı eksik |
| TEST-09 | characterLifeStatusProbe ile story-player-agency testi ayrı çalışıp yaşam geçişi sonrası eylemi sınamıyor | High | Confirmed | Çapraz yaşam/eylem testi eksik |
| GAP-04 | Otomatik yaşlanma, sağlık, doğum tarihi ve mortalite yok; yaşam transition'ı dış olay çağrısı bekliyor | Medium | Confirmed phase boundary | Demografi/karakter yaşam tasarımı gerekli |
| GAP-05 | Yaşam transition'ı `sourceEventId` ister fakat kaynağın gerçekten var olduğunu doğrulamaz | Medium | Confirmed phase boundary | Olay sicili entegrasyonu gerekli |

Ölüm tekrarında oyuncu kimliği `DEAD`, rol adaptörü `INACTIVE_CHARACTER`, kurul
başkanlığı `VACANT` ve normal ikna eylemi `ACTOR_DEAD` oldu. Buna rağmen kredi
ve lobi başarıyla uygulandı: şirket nakdi net +10, borç −20 ve lobi etkisi +0,8
değişti. Emeklilik tekrarında adaptör `PERSONAL_AGENCY_ONLY` ve kurul makamı boş
iken aynı iki PlayerAgency eylemi yine geçti. Kök neden PlayerAgency'nin
`storyCharacterIdentityCanAct` kapısını merkezi olarak çağırmamasıdır; güncel
RCA.md bu hatayı ayrıntılandırır.

## 2.6. Nüfus, demografi ve toplum — ilk denetim sonucu

Nüfusun kanonik sahibi `StoryPopulation`dır. 152 bölgenin her biri yaş, gelir,
meslek, eğitim ve kimlik kesişimini temsil eden 12 sabit profil taşır; bölge
toplamı canlı `node.pop` ile tam kişi düzeyinde, ülke toplamı da bölgelerden
birebir uzlaştırılır. İşgücü yalnız çalışma çağındaki uygun meslek
kohortlarından türetilir. İhtiyaç katmanı gıda, enerji, gelir güvenliği,
güvenlik ve kamu hizmetlerini kohort ağırlıklarıyla yaşam koşuluna çevirir;
kamuoyu bu sonuçlardan aktör-atıflı ve zamanla azalan şikâyet hafızası üretir;
kolektif eylem protesto, grev ve ayaklanma aşamalarıyla üretim etkisine bağlanır.

Göç, güvenlik/ayaklanma/işsizlik/yaşam koşulu baskısından deterministik kaynak ve
hedef seçer; kara/deniz rotası, kabul kapasitesi ve bekleme/iptal sınırı taşır.
Tamamlanmada kaynak ve hedef kohort ile `node.pop` aynı atomik işlemde değişir;
validator bozulursa işlem geri alınır. Nüfus, ihtiyaç, kamuoyu, kolektif eylem ve
göç problarının beşi de izole 1/1 geçti. Mülteci kapasite beklemesi ve 17 kişilik
doğrudan aktarım dünya toplamını sıfır delta ile korudu.

| Kimlik | Bulgu | Önem | Güven | Durum |
|---|---|---|---|---|
| DEMO-01 | Göç eden kişiler şikâyet hafızasını taşımıyor; kaynak ve hedef bölge kohortlarının kayıtları aynen kalıyor | Medium | Confirmed | Toplumsal hafıza aktarım modeli gerekli |
| TEST-10 | humanMigrationProbe kişi korunumunu ölçüyor fakat kamuoyu/hafıza korunumunu ölçmüyor | Medium | Confirmed | Çapraz göç-kamuoyu testi eksik |
| GAP-06 | Organik nüfus büyümesi sabit kohort paylarına dağıtılıyor; doğum, yaşlanma, ölüm ve meslek/eğitim geçişi yok | Medium | Confirmed phase boundary | Demografik transition tasarımı gerekli |
| GAP-07 | Taktik savaş kayıpları birlik havuzunu ve sabit insan gücü maliyetini değiştiriyor; bölge nüfusu/kohort ölümü üretmiyor | Medium | Confirmed phase boundary | Askerî insan gücü–sivil nüfus sözleşmesi gerekli |

Geçerli runtime tekrarında `children` profilinden 17 kişi komşu bölgeye taşındı;
kişi sayıları ve kayıt geçerliliği doğru kaldı. Save sırasında kamuoyu defteri
yeni üye sayılarına uzlaştırıldı, fakat kaynak kohortun üç şikâyet kaydı ve hedef
kohortun mevcut kayıtları içerik olarak birebir değişmeden kaldı. Bunun sonucu,
göçmenlerin geçmiş baskı hafızasını kaynakta bırakıp hedefteki aynı profil
hafızasını anında benimsemesidir. Kök neden kohort kimliğinin bölgeye bağlı olması
ve `storyOpinionReconcilePopulationLinks` işlevinin yalnız bağ/üye sayılarını
değiştirip kayıtları kişi oranında taşımamasıdır; güncel RCA.md bu bulguyu tutar.

Şehir büyümesi yıllık skaler oranla `node.pop` değerini değiştirir; sonraki nüfus
tiki artışı mevcut 12 profil payına yeniden dağıtır. Bu nedenle artış "doğum",
azalış "ölüm" değildir ve çocukların genç, gençlerin yetişkin, yetişkinlerin
emekli kohorta geçişi yoktur. Benzer biçimde savaşta ölen birlikler ordu havuzunda
kalıcı kayıptır ve komutan başına sabit 30 insan gücü düşer, fakat gerçek öldürme
sayısı bölgesel nüfusa bağlanmaz. Bunlar mevcut kodun gizlediği bug diye otomatik
düzeltilmeyecek; önce zaman ölçeği, askerî birlik başına insan ve nüfus kaynağı
sözleşmesi seçilecektir.

## 2.7. Lojistik, rota ve terminal — ilk denetim sonucu

Lojistikte sipariş ve sözleşme `StoryTrade`, sahipli fiziksel lot
`StoryCommerce`, ödeme escrow'u `StoryBudget`, makro koridor
`StoryInfrastructure`, gerçek hex-segment rota ve kapasite rezervasyonu
`StoryRoutePlanner`, araç/terminal hareketi ise `StoryTransportAgents`
tarafından tutulur. Sevkte kaynak stok ve sahipli lot yoldaki kargoya döner;
segment kapasitesi rezerve edilir; araç yükleme, hareket, mod transferi ve
boşaltma kuyruğundan geçer. Teslimat hedef stok, lot mülkiyeti ve ödeme
uzlaşmasını bağlar; kayıp kargoyu yok edip escrow'u serbest bırakır.

Altyapı, ticaret ve ülke-içi dağıtım probları 1/1; route planner, transport
agent, multimodal transfer ve arrival queue testleri ayrıca geçti. Hasarlı
segment ilerlemeyi durduruyor, güvenli ayak sınırından önce yönlendirme
ışınlanmıyor ve iki sipariş aynı kapasite penceresini aşamıyor. Bu kanıtlar
uzun bekleme ile kaynak-terminalde mod değiştiren yönlendirmeyi kapsamıyordu.

| Kimlik | Bulgu | Önem | Güven | Durum |
|---|---|---|---|---|
| LOG-01 | Kaynakta taşıma modu değişen yönlendirme eski terminal yuvasını serbest bırakmıyor | High | Confirmed | Terminal bırakma sırası bugfix adayı |
| LOG-02 | Canlı `HELD` sevkiyatın rota rezervasyonu 3.600 saniyede bitiyor; yük daha sonra aynı kapasite yeniden ayrılmışken devam edebiliyor | Medium | Confirmed | Rezervasyon yaşam döngüsü bugfix adayı |
| LOG-03 | Transit ücret kodu kanonik koridorda bulunmayan `ownerCountryId` alanına bağlı; transit gelir fiilen üretilemiyor | Medium | Confirmed | Koridor sahipliği/transit sözleşmesi gerekli |
| TEST-11 | Yönlendirme testleri güvenli ayak sınırını ölçüyor, kaynakta farklı moda geçişin eski terminal kaydını ölçmüyor | High | Confirmed | Stale-terminal regresyonu eksik |
| TEST-12 | Rota testi kapasite çakışmasını ölçüyor, aktif sevkiyat rezervasyonunun zaman aşımı sonrası sahipliğini ölçmüyor | Medium | Confirmed | Canlı rezervasyon bağı testi eksik |
| GAP-08 | İnsan göçü ticari segment kapasitesini rezerve etmiyor; iki sistem aynı altyapıyı bağımsız kullanıyor | Medium | Confirmed phase boundary | Ortak kapasite politikası gerekli |

Deterministik yönlendirme tekrarında `region:0 → region:1` sevkiyatı
`RAIL:6877:LOAD` terminalinde aktifken hedef `region:2` olarak değiştirildi ve
yeni rota LAND ile başladı. Aynı taşıma ajanı eski RAIL terminalinde aktif kaldı,
ayrıca `LAND:6877:LOAD` terminaline girdi. Ajanın güncel `terminalKey` alanı
yalnız LAND anahtarını taşıdığı için normal release eski RAIL kaydını artık
bulamaz. İki tekrar, iki yuvalı RAIL yükleme terminalini kalıcı olarak
kilitleyebilir. Güncel RCA.md bu kök nedeni tutar.

Uzun-blokaj tekrarında koridorun bütün 1.051 kapasitesini taşıyan sevkiyat
`HELD` kalırken saat 3.601'e alındı; ilk rezervasyon `EXPIRED` oldu ve aynı
rota için ikinci 1.051 birim rezervasyon başarıyla alındı. Trade validator canlı
sevkiyat ile aktif rezervasyon arasında çapraz invariant taşımadığı için bu
durumu reddetmez.

Transit dalı için kaynak ve runtime birlikte kontrol edildi: 631 kanonik
koridorun sıfırında `ownerCountryId` var ve erişim politikalarının tamamı
`ENDPOINT_OWNERS`. `storyTradeProcessCustomsAndTariffs` yalnız bulunmayan tekil
alanı okuduğu için `totalTransitRevenue` artmaz. Önceki tarihsel LEDGER iddiası
silinmedi; yeni çürütme kaydıyla düzeltildi.

## 2.8. Dünya, diplomasi ve savaş — ilk denetim sonucu

Bölgesel askerî kontrolün tek gerçek kaynağı `STORY.nodes[].owner` alanıdır.
Diplomatik çiftler `STORY.rel` içinde tek simetrik anahtarla tutulur; `war`
dışındaki peace/truce/pact/alliance durumları saldırıya kapalıdır. Oyuncu saldırısı,
AI hedef seçimi, kuşatma başlangıcı, kuşatma tiki, kuşatma çözümü ve son fetih
ayrı ayrı `storyIsHostile` denetimi yapar. Bu nedenle “savaş sürerken barış
yapılırsa eski kuşatma yine şehri düşürür” hipotezi çürütüldü: sonraki kuşatma
tiki kuşatmayı temizler.

`peaceProbe` sekiz devletin 28 diplomatik kenarını barışla kurdu; 120 saniyede
sahiplik değişimi üretmedi, kayıt/yükleme ilişkileri birebir korudu ve özellik
kapalı karşı-koşuda fetih oluştu. `battleProbe` ise yalnız tamamlanmış savaşın
telemetri sayaç/sürüm/tohum alanlarını kanıtlar; savaş ilanı yetkisi, fetih
mutabakatı veya gerçek taktik ekranını kanıtlamaz.

| Kimlik | Bulgu | Önem | Güven | Durum |
|---|---|---|---|---|
| WORLD-01 | `territory.transfer` yalnız `node.owner` alanını atomik değiştiriyor; nüfus/iyilik hali/kamuoyu bir sonraki tik öncesinde eski ülkeye bağlı kalıyor | High | Confirmed | Çapraz-defter commit/invalidasyon bugfix adayı |
| WORLD-02 | Emekli ve yürütme makamı olmayan oyuncu harita tıklamasıyla PlayerAgency/kurum kapısını atlayıp barışı savaşa çevirebiliyor | High | Confirmed | Ortak savaş ilanı yetki komutu gerekli |
| WORLD-03 | Fethedilen bölgede tesisler eski ülke şirketlerinde kalırken kamuoyu “işveren/tedarikçi” olarak yeni ülkenin sektör şirketini suçluyor | Medium | Confirmed | Gerçek bölgesel sağlayıcı çözümlemesi gerekli |
| TEST-13 | Dünya tutarlılık validatorü başarılı fetih makbuzu sonrasındaki nüfus sahipliği çelişkisini görmüyor | High | Confirmed | Causality cross-ledger invariantı eksik |
| TEST-14 | Barış probu saldırı engelini güçlü ölçüyor; oyuncunun yaşam/makam yetkisini ve savaş ilanı makbuzunu ölçmüyor | High | Confirmed | Rol × yaşam × giriş yüzeyi testi eksik |

Deterministik fetih fixtüründe `region:25` sahibi `1 → 0` değiştiği anda nüfus,
ihtiyaç ve kamuoyu ülke kimliği `country:1` kaldı. Nüfus validatorü
`POPULATION_OWNER_MISMATCH` ve 12 `POPULATION_COHORT_LINK` hatası verdi; buna
rağmen ihtiyaç, kamuoyu ve genel causality-world validatorleri `ok=true` döndü.
Otuz saniye sonra nüfus zinciri `country:0` ile uzlaştı. Sorun kalıcı veri
kaybından çok, “APPLIED” fetih makbuzundan sonra dünyayı geçici olarak
geçersiz ve farklı ekranlarda çelişkili bırakmasıdır.

Yetki fixtüründe `character:0:0` kanonik olarak `RETIRED` yapıldı. Diplomasi
PlayerAgency görünümü doğru biçimde `DIPLOMACY_LOCKED / Yürütme makamı gerekli`
dedi. Aynı karakter sınırdaki barışçıl devlete tıkladığında `storyNodeClicked`
doğrudan `storyBreakTreaty` çağırdı; treaty `peace → war` oldu ve PlayerAgency
makbuz sayısı sıfır kaldı. Kurum kataloğunda `DECLARE_WAR` zaten EXECUTIVE
yürütücülü bir yetkidir; harita yolu mevcut sözleşmeyi atlamaktadır.

Fetih sonrası tesis ve depolar bilinçli olarak eski şirket mülkiyetinde
kalabiliyor; bu yabancı yatırım modeli olarak korunabilir. Ancak
`storyOpinionAttribution`, gerçek `facility.ownerCompanyId` değerini okumak
yerine kohortun yeni `countryId` değeriyle `company:<yeni ülke>:<sektör>` üretir.
Runtime'da `region:25` tesisleri `country:1` şirketlerindeyken şikâyetler
`company:0:agriculture`, `company:0:energy` ve `company:0:civil_industry`
aktörlerine yazıldı. “İşveren/tedarikçi” etiketi kullanıldığı için bu yalnız
yabancı mülkiyet tercihi değil, yanlış sorumluluk atfıdır.

## 2.9. Teknoloji, çağ ve bilgi/UI — ilk denetim sonucu

Teknoloji ağacı 40 araştırmayı beş dal ve dört kademede tutar. Maliyet taban
değerin 2,5 katı ve her tamamlanan araştırma başına yüzde 10 artar. Kademe 1–2
rutin yönetim Ar-Ge'siyle, Kademe 3–4 ise tasarım yorumuna göre konsey kararıyla
ilerlemelidir. Araştırma puanı düzenli devlet/üretim sonuçlarından gelir; alınan
teknolojiler kanun ve anayasa etkileriyle aynı `_techBonus` bileşiminde savaş,
üretim, gelir, kapasite ve sadakat tüketicilerine dağılır.

WorldV2 yabancı devletlerin `technologyIds` listesini kanonik dünyada taşır.
PlayerKnowledge yabancı hazine/refah gibi gizli alanları UNKNOWN yapar ve genel
causality projeksiyonu bilinmeyen kesin değerleri açmaz. `worldV2Probe` ile
`projectionProbe` bu sınırı geçti. Ancak teknoloji paneli bu bilgi katmanını
kullanmaz; doğrudan `STORY.states[].tech.length` okuyarak sis açıkken bütün
rakiplerin kesin teknoloji sayısını gösterir.

| Kimlik | Bulgu | Önem | Güven | Durum |
|---|---|---|---|---|
| TECH-01 | PlayerAgency Kademe 3–4 araştırmasını öncelik olarak kabul ediyor; rutin Ar-Ge yalnız Kademe 1–2'yi taradığı için öncelik uygulanmadan kalıyor | Medium | Confirmed | Öncelik kapsamı/konsey yönlendirmesi bugfix adayı |
| INFO-01 | Teknoloji paneli PlayerKnowledge'ı atlayıp sis açıkken rakiplerin kesin teknoloji sayısını sızdırıyor | Medium | Confirmed | Bilgi sınıfı ve istihbarat kapısı gerekli |
| ERA-01 | “Komşu devlet çiftleri” diye tanımlanan savaş oranı sınır kontrolü yapmadan bütün yaşayan devlet çiftlerini sayıyor | Medium | Confirmed | Metrik sözleşmesi düzeltmesi gerekli |
| ERA-02 | Çağ açıklaması ahit bozmayı çalkantı kaynağı sayıyor; `storyBreakTreaty` hiçbir `storyEraEvent` üretmiyor | Medium | Confirmed | Olay kaynağı bağlantısı eksik |
| TEST-15 | Mevcut projeksiyon probları genel gizli değerleri koruyor fakat teknoloji panelinin ham `STORY` okumasını kapsamıyor | Medium | Confirmed | Sis-açık UI sızıntı testi eksik |
| TEST-16 | Çağ için bağımsız metrik/geçiş probu yok; mevcut test yalnız çağ değişiminde harita cache invalidasyonunu ölçüyor | Medium | Confirmed | Sınır, olay ve hold-time testleri eksik |

Kademe 3 `heavybat` araştırması gerekli önkoşullarla available hâle getirildi ve
PlayerAgency üzerinden başarıyla `player-action:1` makbuzu üretti. Başlangıçta
20.000 araştırma fonu vardı. Kırk rutin Ar-Ge çağrısından sonra 18 teknoloji ve
8.697 fon bulunmasına, `heavybat` hâlâ available olmasına rağmen araştırma
tamamlanmadı; `playerTechPriority=heavybat` kalıcı kaldı. Kök neden önizleme ve
`storyTechSetPriority` işlevlerinin bütün available kademeleri kabul etmesi,
`storyAIResearch` işlevinin ise `tier > 2` adaylarını koşulsuz atlamasıdır.

Sis-açık UI fixtüründe yabancı `country:1` devletine yedi teknoloji verildi.
PlayerKnowledge aynı anda yabancı kaynakları `UNKNOWN/value=null` tuttu ve
projeksiyon kesin yabancı etki sızdırmadı; teknoloji paneli “İber Federasyonu 7
teknoloji” metnini birebir bastı. Bu, genel bilgi filtresinin hatası değil,
panelin kanonik fakat oyuncuya yetkisiz ham veriyi doğrudan okumasıdır.

Çağ metriğinde sekiz yaşayan devlet için 10 gerçek sınır komşuluğu ve 28 bütün
çift vardı. Birbiriyle sınırı olmayan 0–1 çifti savaşa alındığında `war` metriği
0 yerine tam `1/28` oldu. Ayrıca treaty `peace → war` kırıldığında
`_eraEvents` boş kaldı; aynı defter manuel `storyEraEvent` çağrısını kabul
etti. Güncel kaynaklarda çağ olayını besleyenler grev, sermaye kaçışı ve
komutan firarıyla sınırlıdır; darbe/ahit bozma anlatısı fiilen bağlı değildir.

## 2.10. Konuşma, müzakere ve mekanik sözleşme — ilk denetim sonucu

Konuşma sistemi dünya gerçeğini doğrudan değiştiren serbest metin kapısı
değildir. Oyuncu sözü önce semantik çerçeveye, konuşma eylemine ve aday niyete
dönüşür; belirsiz aktör, şirket, depo, mal, miktar ve hedef için açıklama ister.
Karakter yalnız kendi PlayerKnowledge görünümü ve sahip olduğu hafızayı
kullanabilir. Ham ticaret/şirket defteri veya başka karakterin gizli hafızası
konuşma bağlamına verilmez.

Doğrulanmış ticari yol şu sırayı kullanır:

```text
oyuncu sözü
  -> güvenli anlamlandırma ve rol/varlık çözümü
  -> dünyayı değiştirmeyen domain review
  -> tarafların sürümlü karşı teklif ve kabulü
  -> gerçek kaynak/depo/yetki/escrow mechanical preflight
  -> teslimat yükümlülüğü ve mekanik sözleşme
  -> fiziksel sevkiyat
  -> KEPT / BROKEN / BREACH_PAYMENT_PENDING
  -> para, ilişki, hafıza ve kayıt sonucu
```

`conversationUnderstandingProbe` deterministik ve world-neutral anlamlandırmayı,
uydurma sevkiyat/depo reddini, teklif için onayı, sürümlü müzakereyi, stale kabul
reddini, iki taraf kabul etse bile mekanik koşullar sağlanmadan çalıştırmamayı,
escrow korunumunu ve ticari ihlalin savaş uyduramamasını doğruladı. Anayasal
savaş tam rejim yolunu, barış iki devletin yetkisini gerektiriyor.

`conversationRuntime385Probe` 23 takip turunu kabul etti, tur sınırında durdu,
yalnız karakterin sahip olduğu hafızayı kullandı, yabancı hafızayı gizledi ve
kayıt/yüklemede oturumu birebir korudu. Teslimat yaşam döngüsü probunda normal
teslimat `FULFILLED/KEPT`, ihlal `BREACHED/BROKEN`, ödenemeyen ceza
`BREACH_PAYMENT_PENDING`, yeniden satış `FULFILLED/KEPT` sonuçlarını verdi.
Dört yolun tamamında escrow bir kez ayrıldı, finans ve ilişki sonuçları
idempotent kaldı, müzakere/sözleşme/bütçe/şirket/ticaret validatorleri geçti ve
kayıt/yükleme birebir korundu.

| Kimlik | Bulgu | Önem | Güven | Durum |
|---|---|---|---|---|
| CONV-01 | Ticari konuşma→müzakere→preflight→teslimat zinciri gerçek dünya sonucu ve güvenlik sınırlarıyla bağlı | — | Confirmed healthy | Korunacak sözleşme |
| CONV-02 | Uzun konuşma hafızası karakter sahipliğiyle sınırlı, ham dünya okumuyor ve save/load'da korunuyor | — | Confirmed healthy | Korunacak sözleşme |
| GAP-09 | Grev, ihale, seferberlik, yaptırım, mülteci, banka, esir, boru hattı ve darbe senaryoları deterministik aday üretse de `SCENARIO_LAB_ONLY`; birleşik mekanik adapterleri yok | Medium | Confirmed phase boundary | Ayrı ürün/entegrasyon fazı |
| TEST-17 | Scenario lab testleri özellikle bütün adayların non-executable olmasını başarı sayıyor | Medium | Confirmed | Gelecek entegrasyon kabulü ayrı test ister |

Bu sınır güvenli bir eksikliktir: laboratuvar adaylarının kendiliğinden dünyayı
değiştirmemesi uydurma para, savaş veya makam devrini önler. Adapterler eklenirken
bu güvenlik kaldırılmayacak; her senaryo mevcut domain komutuna, gerçek yetkiye,
kaynağa ve makbuza ayrı ayrı bağlanacaktır.

## 2.11. Fiziksel dünya, konsey ve askerî üretim — kapsam kapatma sonucu

Kaynak modül envanteri kanonik belgede ayrı açıklanmayan dört çalışan katman
gösterdi: hex coğrafya/arazi kullanımı, bölge ve karakter aktivasyonu,
karar/projeksiyon gözlem hattı ve eski konsey–askerî üretim yüzeyi.

Hedefli doğrulamada `activationProbe`, `aggregationProbe`,
`decisionTraceV2Probe`, `relationshipInterpretationProbe`, `cityDossierProbe`,
`projectionProbe`, altı hex dünya probu ve doğal kaynak/tarım/site/inşaat/görsel
katalog/harita renderer testlerinin tamamı geçti. Sağlıklı sözleşmeler şunlardır:

- HOT/WARM/COLD bölge sıklığı kamera ve panel durumundan bağımsızdır; kapalı
  özellik yolu bütün bölgeleri legacy sıklıkta çalıştırır.
- HOT→COLD→HOT kapsülü 152 bölgede nüfus, stok, üretim kuyruğu, şirket,
  bekleyen olay ve bilinmeyen gelecek alanını korur. COLD kayıt henüz canlı
  node yerine çalıştırılmaz; bu bir veri-koruma sözleşmesidir.
- Hex coğrafya ve doğal kaynak katmanı olmayan yükseklik/toprak/maden kanıtını
  uydurmaz. Tarım adayı kanıt yoksa fiziksel tesise terfi etmez.
- Şehir dosyası ve projeksiyon yabancı kesin değerleri `UNKNOWN/null` tutar;
  karar izi yalnız aktörün bilgi referanslarını kullanır.
- Görsel katalog yalnız kurulmuş fiziksel varlık ve izin verilen araştırma
  kademesine göre görünüm seçer.

Konsey runtime karşı örneği ise eski ve ayrıntılı dünya defterlerinin aynı
kararı farklı gerçekliklerde tuttuğunu kanıtladı:

- `census`: 551.133 kişilik kohort defteri byte-eşdeğer kaldı; komutan
  `manpower` ve `oil` toplamları ayrı ayrı 450 arttı, bölgesel enerji değişmedi.
- `roads`: 150 bütçe nakdi düştü ve 25 sahip olunan şehrin zenginliği birer
  arttı; yol ağı karması, altyapı iş emri ve hex inşaat defteri değişmedi.
- `arsenal`: 140 stratejik petrol düştü ve başkent bina toplamı bir arttı;
  fiziksel site/inşaat komutu veya makbuzu oluşmadı.
- Yapay ama geçerli hata fixtüründe `roads.apply` exception üretti; exception
  yutuldu, 150 nakit yine düştü, dünya etkisi sıfır kaldı ve dönüş metni yine
  “Otoyol Yatırım Programı kabul edildi” oldu.

| Kimlik | Bulgu | Önem | Güven | Durum |
|---|---|---|---|---|
| HEX-01 | Coğrafya→bölge→yerleşim→site→inşaat→görsel zinciri kanıt sınırlarını koruyor | — | Confirmed healthy | Korunacak sözleşme |
| SCALE-01 | Bölge/karakter aktivasyonu ve toplulaştırma UI'dan bağımsız, deterministik ve korunumlu | — | Confirmed healthy | Korunacak sözleşme |
| COUNCIL-01 | Eski konsey önergeleri nüfus, stok, altyapı ve hex inşaat komutlarını atlayıp stratejik sayaç/şehir alanını doğrudan değiştiriyor | High | Confirmed | Ürün kararı + ortak domain adapteri |
| COUNCIL-02 | Önerge etkisi exception üretirse ödeme geri alınmıyor ve sahte başarı metni dönüyor | High | Confirmed | Atomik bugfix planı |
| MIL-01 | Birlik üretimi stratejik kaynak/şehir seviyesiyle çalışıyor; ayrıntılı askerî mal, tesis, işgücü ve kohortla tam mutabık değil | Medium | Confirmed architecture seam | Ürün kararı + geçiş planı |
| TEST-18 | Konsey testleri karar telemetrisini görüyor fakat ödeme–fiziksel sonuç atomikliğini ve çapraz-defter etkisini sınamıyor | High | Confirmed | P0 regresyon gerekli |

`COUNCIL-02`, ürün politikası beklemeden ele alınabilecek dar bir hata yoludur:
uygulama başarısızsa ya ödeme ve bütün yan etkiler geri alınmalı ya da ödeme
etkiden sonra atomik commit edilmelidir. `COUNCIL-01` ve `MIL-01` ise hangi
eski sayaçların korunacağı seçilmeden topluca “modernize” edilmemelidir.

## 3. Sistem haritası

| Sistem | Kanonik sahipler | Girdi | Ürettiği gerçek | Bağlandığı sistemler | İnceleme durumu |
|---|---|---|---|---|---|
| Kampanya yaşam döngüsü | `Story.js`, `StoryClock.js`, `StoryScheduler.js`, `StoryMigration.js` | kurulum, saat, kayıt | aktif dünya, zaman, devamlılık | bütün sistemler | Başladı |
| Dünya ve bölgeler | `StoryWorldV2.js`, `StoryRegions.js`, `StoryHexWorld.js` ailesi | harita, sahiplik, tohum | ülke/bölge/hücre kimliği | ekonomi, siyaset, lojistik, UI | İlk sahiplik dikeyi tamamlandı; fetih commit'i bağımlı defterleri atomik güncellemiyor |
| Fiziksel arazi ve imar | hex coğrafya/doğal kaynak/site/inşaat/land management modülleri | raster, kanıt, başvuru, kaynak, süre | geçilebilir hücre, tesis yuvası, inşaat makbuzu | şehir, ekonomi, lojistik, render | İlk dikey tamamlandı; kanıt sınırları ve hedefli testler sağlam |
| Ekonomi | `StoryRegionalEconomy.js`, `StoryMarket.js`, `StoryBudget.js`, `StoryEconomicAI.js` | üretim, stok, fiyat, para | üretim/tüketim, fiyat, bütçe, ekonomik karar | şirket, nüfus, lojistik, devlet | Başladı; para korunumu ihlali bulundu |
| Şirket ve banka | `StoryCompanies.js`, `StoryCommerce.js`, `StoryMechanicalContracts.js` | tesis, nakit, kredi, sözleşme | bilanço, mülkiyet, yatırım, iflas | ekonomi, karakter, devlet, lojistik | İlk dikey tamamlandı; sahiplik rolü belirsiz, kurul bypass ve iflas sonrası kredi bulundu |
| Devlet ve siyaset | `StoryInstitutions.js`, `StoryStateCapacity.js`, `StoryElections.js`, `StoryIntegrity.js`, `StoryPoliticalCrisis.js`, `StoryGovernance.js` | anayasa, makam, destek, kanıt | yetki, uygulama, seçim, soruşturma, kriz | karakter, nüfus, bütçe, diplomasi | İlk dikey tamamlandı; seçim ve darbede yürütme sahipliği ayrışıyor, yaptırım halkası eksik |
| Takvim ve konsey | `Council.js`, `StoryClock.js`, `StoryBudget.js` | iki yıllık gündem, komutan oyu, yönetici kararı | kanun/teknoloji/önerge ve sadakat sonucu | bütün devlet ve üretim sistemleri | İlk dikey tamamlandı; eski önergeler kanonik domain defterlerini atlıyor, hata sonucu atomik değil |
| Karakterler | `StoryCharacters.js` ve karakter alt katmanları | kimlik, hedef, ilişki, hafıza, algı | aday, karar, eylem, konuşma | tüm toplumsal ve kurumsal sistemler | İlk yaşam dikeyi tamamlandı; temel defterler sağlam, ölü/emekli PlayerAgency kaçışı bulundu |
| Nüfus ve demografi | `StoryPopulation.js`, `StoryNeeds.js`, `StoryHumanMigration.js` | kohort, stok, güvenlik, rota | nüfus, ihtiyaç, refah, göç | ekonomi, kamuoyu, siyaset | İlk dikey tamamlandı; kişi korunuyor, demografik geçişler yok |
| Toplum | `StoryOpinion.js`, `StoryCollectiveAction.js`, `StoryPowerCenters.js`, `StorySocial.js` | ihtiyaç sonucu, hafıza, aktör | kamuoyu, protesto/grev, güç merkezi | devlet, karakter, ekonomi | İlk dikey tamamlandı; göç şikâyet hafızasını taşımıyor |
| Lojistik ve altyapı | `StoryTrade.js`, `StoryInfrastructure.js`, `StoryRoutePlanner.js`, `StoryTransportAgents.js`, `StoryInfrastructureWorks.js` | sözleşme, stok, rota, kapasite | fiziksel sevkiyat, araç, bakım ve yeni hat | ekonomi, şirket, göç, harita | İlk dikey tamamlandı; terminal sızıntısı, rezervasyon zaman aşımı ve ölü transit dalı bulundu |
| Diplomasi ve savaş | `Talks.js`, `StoryAI.js`, `Story.js`, ortak savaş motoru | ilişki, düşmanlık, güç, oyuncu emri | anlaşma, savaş, fetih, kayıp | devlet, karakter, ekonomi, toplum | İlk dikey tamamlandı; düşmanlık kapıları sağlam, oyuncu savaş ilanı kurum/yaşam yetkisini atlıyor |
| Askerî üretim | `Production.js`, `Story.js`, taktik havuz köprüsü | şehir binası, teknoloji, stratejik kaynak, süre | komutan ordusu, garnizon ve savaş bütçesi | savaş, ekonomi, demografi | İlk dikey tamamlandı; oynanabilir havuz sağlam fakat ayrıntılı fiziksel defterlerle tam mutabakat yok |
| Teknoloji ve çağ | `techTree.js`, `Era.js`, `Story.js` | AR-GE puanı, dünya durumu | kabiliyet ve gelir/savaş etkisi | ekonomi, devlet, savaş | İlk dikey tamamlandı; yüksek kademe önceliği ölü, çağ metriği sınır ve olay kaynaklarıyla ayrışıyor |
| Bilgi ve UI | `PlayerKnowledge.js`, `StoryProjection.js`, `StoryUI.js`, `StoryRender.js` | kanonik defter ve erişim seviyesi | oyuncunun görebildiği dünya | bütün sistemler | İlk dikey tamamlandı; genel filtre sağlam, teknoloji paneli ham yabancı bilgi sızdırıyor |
| Konuşma ve müzakere | konuşma/semantik modülleri, `StoryNegotiation.js`, `StoryMechanicalContracts.js` | oyuncu sözü, kanıt paketi, karakter durumu | güvenli yanıt, teklif, görev/müzakere ve fiziksel sözleşme | karakter, şirket, devlet, diplomasi | İlk dikey tamamlandı; ticari yaşam döngüsü bağlı, dokuz özel senaryo lab-only |
| Ölçekleme ve gözlem | aktivasyon/toplulaştırma/telemetri/decision trace modülleri | kanonik dünya, tik, olay ve bilgi referansı | çalışma bütçesi, korunum kapsülü, teşhis ve açıklama | bütün sistemler | Hedefli problar geçti; COLD özet henüz canlı simülasyon yerine kullanılmıyor |

## 4. Her sistem için soracağımız sorular

Her bölüm aynı kapılardan geçecektir:

1. Bu sistem oyunda neden var; oyuncuya hangi anlamlı kararı veriyor?
2. Kanonik veri sahibi kim; aynı gerçeğin ikinci ve çelişkili kopyası var mı?
3. Girdiler nereden geliyor; çıktı hangi sistemleri gerçekten değiştiriyor?
4. Oyuncu ile AI aynı kurallara mı tabi?
5. Kaynak, yetki, zaman, rota, bilgi ve idempotency kapıları var mı?
6. Kayıt/yükleme aynı geleceği sürdürüyor mu?
7. UI kanonik gerçeği mi gösteriyor, yoksa yalnız dekoratif bir temsil mi?
8. Hata/fallback yolu görünür mü; sessizce başka gerçeklik üretiyor mu?
9. Test hangi gerçek davranışı kanıtlıyor; hangi davranışı yalnız çalıştırıyor?
10. Sistem başka bir sistemle birleştiğinde ortaya çıkan ikinci dereceden sonuç ne?

## 5. Bulgu kayıt biçimi

Her bulgu aşağıdaki biçimde eklenecektir:

```text
Başlık:
Kategori:
Önem: Critical / High / Medium / Low
Güven: Confirmed / Likely / Speculative
Konum:
Belirti:
Mekanizma:
Kök neden:
Kanıt:
Karşı hipotez:
Çürütme testi ve sonucu:
Oyuncuya etkisi:
Düzeltme seçenekleri:
Davranış değişikliği riski:
Gerekli regresyon testi:
Karar: Açık / Kabul / Reddedildi / Düzeltildi
```

Bir test başarısızlığı otomatik olarak oyun bugı sayılmayacaktır. Testin bayat
olması, harness hatası, belge-kod sapması ve gerçek runtime kusuru ayrı
hipotezlerdir. Çürütülen hipotezler silinmeyecek; aynı yolu yeniden yürümemek
için kayıtta kalacaktır.

## 6. İnceleme ve çalışma planı

### Aşama 0 — Kapsamı ve tabanı dondur

- Mevcut kullanıcı değişikliklerine dokunma.
- Kanonik belgeleri, `LEDGER.md` kararlarını ve canlı özellik bayraklarını oku.
- Hedefli kısa testleri ve sonra tam hikâye paketini kaydet.
- Gerçek Electron oynanışında kurulum, ilk 10 dakika, kayıt/yükleme ve savaş
  dönüşü için gözlem listesi oluştur.

Çıkış kapısı: incelenen commit, test sonucu ve oynanış ortamı belli olmalıdır.

### Aşama 1 — Baştan sona oyuncu yolculuğu

- Ana menüden kurulum ve karakter yaratımına giriş.
- Yeni kampanya kurulum sırası ve başlangıç değişmezleri.
- Harita, zaman, duraklatma, toplantı ve konuşma sırasında saat davranışı.
- Oyuncu kararının makbuz ve görünür sonuca dönüşmesi.
- Savaş başlatma, taktik sonuç ve dünyaya dönüş.
- Kayıt, yükleme, bozuk/eski kayıt ve devamlılık.
- Yenilgi ve kullanıcıyla kararlaştırılacak başarı/zafer sözleşmesi.

Çıkış kapısı: başlangıçtan mevcut tek bitişe kadar bir akış diyagramı, kanıtlı
bulgular ve öncelikli regresyon listesi.

### Aşama 2 — Ekonomi, şirket ve lojistik dikeyi

- Kaynak -> üretim -> stok -> ihtiyaç/talep -> fiyat zinciri.
- Şirket/banka bilançosu, kredi, yatırım, iflas ve mülkiyet.
- Sipariş -> rezervasyon -> rota -> araç -> teslimat -> ödeme uzlaşması.
- Devlet bütçesi, vergi, borç, faiz, para basımı ve temerrüt.
- Ekonomik AI'nin amaçları, hile sınırı ve performans maliyeti.

Çıkış kapısı: para ve malın korunum tablosu; tıkanma, çift yazma, yoktan üretim
ve sonsuz döngü testleri.

### Aşama 3 — Siyaset ve devlet yönetimi dikeyi

- Güç merkezleri -> kurum -> makam -> yetki -> uygulama bileti.
- Seçim, iktidar devri, soruşturma, yolsuzluk, darbe ve iç kriz.
- Oyuncunun dört başlangıç rolünde gerçek yetki ve alternatif yollar.
- Devlet kararının bütçe, nüfus, bölge ve karakter sonucuna bağlanması.

Çıkış kapısı: her siyasi eylem için yetkili aktör, kaynak, maliyet, gecikme ve
fiziksel sonuç matrisi.

### Aşama 4 — Karakter, ilişki ve konuşma dikeyi

- Kimlik, hedef, değer, korku, kırmızı çizgi ve kariyer yaşam döngüsü.
- Yönlü ilişkiler, hafıza, algılanan dünya ve karar izi.
- Eylem adayları, deterministik seçici, sınırlı LLM hakemi ve konuşma güvenliği.
- Teklif, görev, müzakere, söz, ihlal ve mekanik sözleşmeye geçiş.

Çıkış kapısı: karakterin "neden bunu yaptığı" kaynak kimlikleriyle açıklanmalı;
metin ile mekanik sonuç birbirinin yerine geçmemelidir.

### Aşama 5 — Nüfus, demografi ve toplum dikeyi

- Kohortların oluşumu, doğum/ölüm/yaşlanma iddiası ve gerçek uygulama durumu.
- İhtiyaç, refah, güvenlik, kamuoyu ve şikâyet hafızası.
- Protesto, grev, radikalleşme, iç/dış göç ve mülteci akışı.
- Demografinin işgücü, seçim, şirket ve savaş kaybıyla mutabakatı.

Çıkış kapısı: toplam kişi korunumu ve bütün nüfus değişimlerinin kaynak olayı.

### Aşama 6 — Diğer sistemler ve çapraz bağlar

- Diplomasi, savaş, teknoloji, çağ, medya/haber, harita, bilgi sisi ve UI.
- Sistemlerin ikili değil çoklu birleşimleri: örneğin savaş -> lojistik -> fiyat
  -> ihtiyaç -> kamuoyu -> seçim -> devlet kapasitesi.
- Uzun koşu, deterministik tekrar, kayıt ortası devam ve performans bütçesi.

Çıkış kapısı: sistemler arası neden-sonuç matrisi ve açık tasarım kararları.

### Aşama 7 — Onaylı düzeltme planları

- Her bug için ayrı kök neden ve önce başarısız olan regresyon testi.
- Davranış düzeltmesi ile davranış-koruyan refaktörü ayrı planlara böl.
- Küçük, geri alınabilir adımlar; her adım sonrası hedefli ve çapraz test.
- Kullanıcı onayı olmadan taslak plan uygulanmaz.

## 7. Planı çürütme

İlk bakışta "bütün `Story*` dosyalarını sırayla okuyup bütün hataları düzeltmek"
makul görünür. Bu yaklaşım aşağıdaki nedenlerle reddedilmiştir:

| İlk plan varsayımı | Neden çöker | Yerine konan kural |
|---|---|---|
| Dosya sırası sistem davranışını açıklar | Gerçek davranış onlarca modülün aynı tikteki etkileşimidir | Dosya değil, baştan sona dikey oyuncu sonucu izlenir |
| Yeşil test çalışan sistemi kanıtlar | Test yalnız bayat sözleşmeyi veya mock'u doğrulayabilir | Her test için "hangi gerçek bugı yakalar?" sorulur |
| Bulunan her eksik bugdır | Zafer koşulu gibi boşluklar bilinçli sandbox kararı olabilir | Önce ürün kararı, sonra bug/tasarım borcu sınıflaması |
| Bütün buglar tek büyük planda çözülür | Kapsam büyür, neden-sonuç ve geri dönüş sınırı kaybolur | Bulgular küçük ve bağımsız onaylı planlara ayrılır |
| Belgeler güncel gerçektir | 0,5 saniyelik lojistik kaydı aynı gün 10 saniyeye değişmiştir | Belge iddiası kod, Git ve runtime ile çaprazlanır |
| Kod incelemesi oynanışı kanıtlar | Görsel tıklama, algılanan sonuç ve tempo statik analizden çıkmaz | Gerçek Electron oynanış kabulü ayrı kapıdır |
| Tam paket tek başına yeterlidir | Uzun paket hatanın yerini ve oyuncu etkisini belirsiz bırakabilir | Önce hızlı dikeyler, sonra çapraz ve tam paket |
| Tam simülasyon paketi uçtan uca hikâyeyi kapsar | Harness savaş girişini no-op, yenilgi kontrolünü sürekli false yapıyor | Dünya simülasyonu ile gerçek yaşam-döngüsü entegrasyonu ayrı paketlenir |
| Kırmızı test runtime bugını gösterir | Aktivasyon probu yürütme yerine görev sicili sırasını ölçüyor | Önce ölçülen sözleşmeyi doğrula, sonra kod değiştir |
| Tek bir “savaş sonucu” testi sonuç akışını kanıtlar | Mevcut prob yalnız telemetri alanlarını kontrol ediyor | Sahiplik, havuz, ödül, kayıt/devam ve yenilgi ayrı kapılar olur |
| Yeşil domain probları entegrasyonu kanıtlar | Seçim ve yönetim probları ayrı ayrı geçerken EXECUTIVE oyuncu ile seçilmiş mandat iki farklı Cumhurbaşkanı üretiyor | Kritik makam, para ve mülkiyet sınırlarında çapraz-defter invariantı kurulur |
| Cache anahtarındaki revision adı değişimi yakalar | Governance cache'i kurum defterinde hiç bulunmayan revision alanını 0 sayıyor | Cache yalnız gerçek, artan sürüm veya sahiplik imzasıyla geçersizleşir |
| Darbe probunun SUCCESS sonucu iktidar devrini kanıtlar | Prob kriz defteri ve hafızayı ölçüyor; kurum EXECUTIVE sahibi eski seçilmiş kişide kalıyor | Her iktidar geçişinde crisis/election/institution/career/governance aktör kimlikleri birlikte sınanır |
| Kanıtlanmış yolsuzluk vakası yaptırım uygulandığını gösterir | Faz 32 sözleşmesi bilinçli olarak kayıt-only ve fiziksel mutasyonsuzdur | Soruşturma ile yaptırım ayrı aşamalar olarak açıkça belgelenir ve bağlanır |
| `organizationId` şirket sahipliğini kanıtlar | Bağ oyuncuya yönetim yetkisi verir; pay defteri oyuncuya sıfır hisse verir | Sahiplik, kurul makamı ve yönetim temsil yetkisi ayrı kanonik gerçekler olur |
| Rol-yetkili PlayerAgency bütün şirket kurallarını uygular | Doğrudan kredi yolu kurul kuyruğunu ve şirket faaliyet durumunu atlıyor | UI/AI/karakter yolları tek domain komutuna ve aynı precondition setine iner |
| Geçerli şirket defteri geçerli kredi yaşam döngüsü demektir | Validator dengeli toplamları kabul eder; feshedilmiş şirketin yeni borcu da geçer | Durum-geçiş invariantları bilanço invariantlarından ayrı sınanır |
| Karakter ölüm testi bütün eylemleri kapatır | Prob yalnız CharacterAction yolunu sınar; PlayerAgency ölü aktörü yine çalıştırır | Aktör yaşam kapısı bütün komut yüzeylerinin ortak girişinde uygulanır |
| `sourceEventId` yaşam olayını kanıtlar | Geçiş yalnız boş olmayan dizge ister, olay sicilinde varlığını doğrulamaz | Yaşam geçişi kanonik ve doğrulanmış kaynak olaya bağlanır |
| Göçte kişi korunumu toplumsal sürekliliği de kanıtlar | Kişiler doğru taşınırken şikâyet hafızası bölge-kohort kimliğinde sabit kalıyor | Fiziksel kişi ve taşınan toplumsal durum için ayrı korunum invariantları kurulur |
| Skaler nüfus artışı gerçek demografik yaşlanmadır | Artış mevcut bütün yaş/meslek profillerine aynı pay mantığıyla dağılıyor | Doğum, ölüm, yaşlanma ve meslek geçişleri kaynak olaylı ayrı model olur |
| Birlik kaybı nüfus kaybıdır | Savaş gerçek birlik havuzunu eritiyor ama nüfusa yalnız sabit komutan insan gücü maliyeti var | Birlik büyüklüğü ve askerî nüfus kaynağı seçilmeden kohort ölümü yazılmaz |
| Güvenli sınır yönlendirme testi bütün reroute yaşam döngüsünü kanıtlar | Kaynakta mod değişimi eski terminal kaydını sahipsiz bırakıyor | Reroute öncesi terminali bırak, sonra rezervasyon/rota/ajanı atomik değiştir |
| Süreli rota rezervasyonu canlı yükü korur | Rezervasyon saatten düşüyor; shipment durumu veya ownerId canlılığına bakmıyor | Rezervasyon ömrünü sevkiyat terminal durumuna bağla veya açık lease yenile |
| Transit gelir alanı transit ekonomisinin çalıştığını kanıtlar | Kanonik koridorlarda kodun okuduğu sahiplik alanı hiç yok | Koridor sahipliğini tek şemada üret, rota izni ve ücreti aynı makbuzda çöz |
| Barış sırasında başlamış kuşatma fetihle sonuçlanır | Kuşatma tiki, çözümü ve fetih anı düşmanlığı yeniden denetliyor | Hipotez çürütüldü; mevcut koruma regresyonla sabitlenir |
| PlayerAgency diplomasi kapısı bütün savaş ilanlarını korur | Harita tıklaması doğrudan treaty kırıp saldırı başlatıyor | Bütün yüzeyler ortak yetkili komuta indirilir |
| Fetih makbuzu dünya sahipliğini atomik uzlaştırır | Yalnız `node.owner` transaction içinde; nüfus zinciri scheduler tikini bekliyor | Transfer sonrası çapraz-defter invariantı kurulur |
| PlayerKnowledge probu bütün UI bilgi sızıntılarını yakalar | Teknoloji paneli projeksiyon yerine ham `STORY.states` okuyor | Her panelin veri kaynağı ayrıca envanterlenir ve sis fixture'ı çalıştırılır |
| “Available” araştırma önceliği yürütülebilir demektir | Öncelik bütün kademeleri kabul ediyor; rutin yürütücü Kademe 3–4'ü dışlıyor | Önizleme ile gerçek tüketici aynı adaylık sözleşmesini paylaşır |
| Çağ etiketi gerçek olay girişlerini eksiksiz özetler | Sınır olmayan savaş sayılıyor, ahit bozma/darbe olayı deftere girmiyor | Her metrik için kaynak olay ve ters örnek testi kurulur |

Planın kendisi şu koşullarda durdurulup yeniden kurulmalıdır:

- Kampanyanın amaçlanan bitişi konusunda kullanıcı kararı, mevcut sonsuz dünya
  varsayımını değiştirirse.
- Kanonik veri sahibinin belgede gösterilenden farklı olduğu kanıtlanırsa.
- Tam test paketi başlangıçta kırmızıysa ve kırılma incelenecek modülü güvenilir
  biçimde ayırmayı engelliyorsa.
- Çalışma ağacındaki kullanıcı değişiklikleri hedef dosyalarla çakışırsa.
- Bir düzeltme birden fazla sistemin oyuncuya görünen davranışını değiştiriyorsa;
  bu durumda refaktör değil ayrı tasarım kararı gerekir.

## 8. Açık kullanıcı kararları

1. Hikâye modu sonsuz yaşayan sandbox mı olmalı, yoksa bir veya birden fazla
   kampanya başarı/zafer koşulu bulunmalı mı?
2. Oyuncunun ana fantezisi hangisi: devlet lideri, rol tabanlı birey, şirket
   yöneticisi, askerî komutan veya bunların kariyer içinde değişen birleşimi mi?
3. Dünya temposunda 10 gerçek saniye = 1 oyun ayı sözleşmesi kalıcı mı?
4. İlk derin inceleme sırası yaşam döngüsünden sonra ekonomi/lojistik mi, yoksa
   siyaset/devlet yönetimi mi olmalı?
5. Dış ticarette ithalat vergisini alıcı devlet/şirketten hangisi; ihracat
   harcını satıcı devlet/şirketten hangisi; transit ücretini alıcı, satıcı veya
   taşıyıcıdan hangisi ödemeli?
6. EXECUTIVE oyuncu seçim kaybında hangi kariyere geçmeli: muhalefet lideri,
   bağımsız siyasi figür, başka bir devlet makamı veya oyun içinde seçilecek bir
   kariyer yolu mu? Oyuncu yeniden aday olabilecek mi?
7. Başarılı darbe sonrasında oyuncu ve ülke nasıl devam etmeli: kriz lideri
   kanonik yürütme sahibi mi olmalı; oyuncu görevden düşüp muhalefet/direniş
   rolüne mi geçmeli; `SPLIT` sonucu gerçek bölgesel sahiplik yaratmalı mı?
8. Kanıtlanmış yolsuzluğun yaptırım kataloğu ne olmalı: görevden alma, para
   iadesi/ceza, şirket ihale yasağı, itibar/ilişki kaybı ve ceza davasından
   hangileri hangi kurum kararıyla uygulanmalı?
9. `COMPANY_OWNER` başlangıcı gerçekten kişisel hisse sahipliği mi, hanehalkı
   adına yönetim kurulu başkanlığı mı, yoksa profesyonel şirket yöneticiliği mi?
   Hisse varsa oranı ve temettü/sermaye kazancı nasıl işleyecek?
10. Şirket kredilerinde hangi karar politikası geçerli: oyuncu tek imzayla mı,
    tutara göre CFO/CEO/kurul eşiğiyle mi, yoksa banka+kurul çift onayıyla mı?
11. Oyuncu karakter ölür veya emekli olursa kampanya nasıl devam etmeli: halef
    karaktere kontrol devri, yeni karakter seçimi, hanedan/kurum devamı veya
    kampanya sonu seçeneklerinden hangisi uygulanmalı?
12. Demografik model ne kadar ayrıntılı olmalı: yalnız yıllık doğum/ölüm/yaşlanma
    geçişleri mi, yoksa eğitim, meslek, işsizlik ve askerî hizmet geçişleri de mi?
13. Göçmenler hangi toplumsal durumu taşımalı: şikâyet hafızası, siyasi eğilim,
    kimlik ve eğitim/meslek dağılımının tümü mü; hedef toplumla uyum hangi hızda olmalı?
14. Taktik bir birlik kaç kişiyi temsil ediyor ve asker kaybı hangi bölge/kohorttan
    düşmeli? Sabit `-30` insan gücü kalacak mı, gerçek kayıpla mı değişecek?
15. Koridor kapasitesi neyi temsil etmeli: aynı anda yoldaki toplam yük mü,
    segment başına akış hızı mı, yoksa zaman pencereli tonaj mı?
16. Üçüncü ülke transit hakkı ve koridor geliri nasıl kurulmalı: koridorun sahibi
    tek devlet mi, iki uç devlet mi; geçiş için ayrı anlaşma ve ödeme zorunlu mu?
17. Mülteci/göç akışı ticari yol kapasitesini tüketmeli mi; tüketirse insani
    öncelik, askerî/ticari yük ve yolcu kapasitesi hangi sırayla paylaşılmalı?
18. Savaş ilanını hangi rejimlerde yalnız yürütme, hangi rejimlerde yasama veya
    silahlı kuvvetler onaylamalı; oyuncu yalnız komutansa teklif mi sunmalı?
19. Fethedilen bölgelerde özel şirket tesisleri yabancı mülkiyette mi kalmalı,
    geçici kayyıma mı alınmalı, kamulaştırılmalı mı; vergi ve lisans yetkisi kimde olmalı?
20. Fetih anındaki nüfus/iyilik hali/kamuoyu devri aynı transaction içinde mi
    olmalı, yoksa görünür bir işgal/geçiş dönemi olarak ayrı durum mu taşımalı?
21. Rakip teknoloji bilgisi hangi koşulda görünmeli: yalnız toplam tahmin,
    istihbarat teknolojisiyle kesin sayı, yoksa kamuya açık araştırma sicili mi?
22. Kademe 3–4 için oyuncu “öncelik” verebilmeli mi; bu konsey gündemine bağlayıcı
    öneri mi, yalnız oy ağırlığı mı, yoksa panelden tamamen kaldırılmalı mı?
23. Çağın savaş yoğunluğu bütün diplomatik savaşları mı, yalnız ortak sınırları mı,
    yoksa nüfus/toprak/ağırlıklı aktif cepheleri mi ölçmeli?
24. Dokuz özel konuşma senaryosundan hangileri önce gerçek mekaniğe bağlanmalı;
    oyuncu etkisi ve mevcut domain olgunluğuna göre öncelik sırası ne olmalı?
25. Konseyin eski `oil/manpower/points`, şehir seviyesi ve doğrudan önerge
    etkileri korunacak bir stratejik üst katman mı; yoksa bütçe, nüfus, stok,
    altyapı ve hex inşaat komutlarına tamamen mi indirilmeli?
26. Birlik üretimi ayrıntılı ekonomide hangi fiziksel reçeteyi kullanmalı:
    askerî malzeme + enerji + işgücü + kohort mu; stratejik sayaçlar yalnız UI
    özeti mi kalmalı; geçişte eski kayıtların orduları nasıl değerlenmeli?

## 9. Sonraki çalışma oturumu

- Kullanıcıyla ödül sözleşmesini seç: yalnız zafer, sonuç bazlı teselli veya başka bir model.
- Kullanıcıyla son bölge kuralını seç: anında yenilgi veya gerçek sürgünden dönüş mekaniği.
- Onaydan sonra önce P0 regresyon testleri için küçük uygulama planı çıkar.
- Gerçek Electron akışında kurulum -> savaş -> sonuç -> kayıt/devam kabulünü çalıştır.
- Gümrük tahsilat sözleşmesini kullanıcıyla seç; ardından atomik rezervasyon,
  settlement ve para korunumu için küçük, ayrı bir uygulama planı çıkar.
- Aşama 2'de üretim/stok/mal korunumu ile kredi-faiz-temerrüt zincirini derinleştir.
- EXECUTIVE oyuncunun incumbent/adaylık/seçim kaybı kariyer sözleşmesini seç;
  ardından tek kanonik makam sahibi ve cross-ledger regresyon planı çıkar.
- Governance cache makam değişimi ve TEST-05 assertion eksikliği için küçük,
  seçim sahipliği düzeltmesinden bağımsız bir bugfix planı hazırla.
- Darbe lideri makam devri için seçim geçişiyle ortak kanonik yürütme transition
  makbuzu tasarla; politicalCrisisProbe'a kurum/kariyer/yetki invariantı ekle.
- Aşama 4 karakter, ilişki ve konuşma dikeyine geç.
- Şirket sahibi/yöneticisi ürün sözleşmesini seç; pay, kurul makamı ve temsil
  yetkisini birbirinden ayıran küçük sahiplik planı çıkar.
- Kredi kurul bypass'ı ve iflas sonrası kredi için önce P0 çapraz-yol regresyon
  planı çıkar; kredi yaşam döngüsünü ayrı tasarım fazı tut.
- PlayerAgency genel yürütücüsüne yaşam durumu regresyon planı çıkar; oyuncu
  ölümü/emekliliği sonrası kontrol devri ürün kararını ayrı tut.
- Göçte toplumsal hafıza aktarımı için önce başarısız çapraz-defter testi ve
  taşınacak durum sözleşmesi tasarla; fiziksel kişi aktarım kapısını değiştirme.
- Demografik geçiş ayrıntısı ve askerî nüfus kaynağı için kullanıcı kararını al;
  bunları bugfix değil ayrı tasarım fazı olarak planla.
- Aşama 6 lojistik ve diğer bağlı sistemler dikeyine geç.
- Kaynakta mod değiştiren yönlendirme için eski terminal release sırasını ve
  iki tekrar sonrası kapasiteyi doğrulayan küçük bugfix planı çıkar.
- Canlı sevkiyat–rezervasyon invariantı ile transit koridor sahipliğini ayrı
  planlar olarak tut; ikincisi ürün kararı olmadan uygulanmasın.
- Aşama 6'nın kalan dünya/diplomasi/savaş/teknoloji/bilgi-UI sistemlerine geç.
- Dünya/diplomasi/savaş için önce emekli oyuncu savaş ilanı bypass'ı ve fetih
  sonrası atomik sahiplik regresyonlarını planla; yabancı tesis politikası
  seçilmeden şirket mülkiyetini değiştirme.
- Sonraki dikeyde teknoloji, çağ, bilgi sisi ve UI projeksiyonuna geç.
- Teknoloji/çağ/bilgi-UI ilk dikeyi tamamlandı; şimdi bütün bulguları bağımlılık,
  ürün kararı ve önce-kırmızı test kapılarıyla toplam bugfix planında birleştir.
