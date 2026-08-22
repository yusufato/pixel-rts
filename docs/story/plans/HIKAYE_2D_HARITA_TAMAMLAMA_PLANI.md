---
status: active
owner: osman
last-reviewed: unknown
canonical: true
---

# Hikâye Modu 2B Harita Tamamlama Sözleşmesi

Durum: aktif ürün yolu  
Resmî renderer: `2d`  
3B prototip: `_arsiv/Story3D-shelved-2026-08-21.zip`

Bu belge yeni ve paralel bir harita planı değildir. Çalışan altıgen 2B motorun
hangi koşullarda **tamamlandı** sayılacağını tanımlar. Kanonik dünya verisi,
ekonomi, lojistik, savaş ve karakter katmanları harita tarafından yeniden
uydurulamaz; harita yalnız onların fiziksel ve etkileşimli görünümüdür.

## Değişmez ilkeler

1. Tek resmî renderer vardır: 2B. 3B kodu, testi, bağımlılığı veya başlatma
   bayrağı aktif ürüne geri sızamaz.
2. Görünen her şehir, tesis, yol, ray, liman, araç, hasar ve şantiye kanonik
   bir kayıtla açıklanır. Dekor, simülasyon gerçeği gibi sunulamaz.
3. Altıgen dünya tek fiziksel otoritedir. Şehir ve altyapı denize/dağa taşamaz;
   yollar motorun kullandığı komşu hücre zincirinden çizilir.
4. Statik atlaslar bir kez çözülür ve RAM'de tutulur. Kamera sürükleme/zoom,
   şehir veya ağ bitmapini yeniden üretmez.
5. Uzak/orta/yakın LOD bilgi yoğunluğunu değiştirir; dünya boyutunu veya
   varlığın fiziksel hücresini değiştirmez.
6. 2010–2100 görsel dönemleri yalnız gerçek teknoloji/kurulum aşaması seçicisi
   varsa açılır. Seçilemeyen binlerce kopya üretmek ilerleme sayılmaz.

## Tamamlanma kapıları

### G0 — Tek 2B ürün yolu

- [x] Electron yalnız `2d` renderer bildirir.
- [x] `index.html` Three.js/Story3D yüklemez.
- [x] 3B kaynak, test, lisans ve son kanıt tek geri alınabilir ZIP'tedir.
- [x] Paket ve altyapı testlerinde bayat 3B atfı kalmaz.

### G1 — Coğrafi ve politik doğruluk

- [x] Kara/su/kıyı, geçilemez arazi, 152 bölge ve politik sahiplik altıgendir.
- [x] 152 şehir ve fiziksel liman uçları geçerli hücrelere bağlıdır.
- [x] Kara, deniz ve ray güzergâhları kanonik komşu hücre zinciridir.
- [x] Kaynak coğrafya borçları İzmir/Beyrut gibi terminal fallback'lerinde UI'da
  açıkça görünür; görsel hata gibi gizlenmez.

### G2 — 2B görsel dil ve okunabilirlik

- [ ] Arazi, orman, dağ, deniz, kırsal çevre, şehir, ilçe ve liman atlasları
  oyuncunun son görsel kabulünü alır; temel atlaslar vardır fakat bina/tesis
  çeşitliliği henüz tamamlanmadı.
- [x] Yakın görünümde fiziksel tesis, arazi kullanımı ve inşaat aşaması.
- [x] `BURNING`, `BURNED`, `DAMAGED`, `ABANDONED` birbirinden net ayrılır.
- [x] Şehir/ilçe/liman/tesis ikonları 720p–1440p ve üç LOD'da bulanıklaşmaz,
  birbirini veya etiketi kapatmaz.
- [x] Yol/ray/sınır renk, kalınlık ve kavşak hiyerarşisi üç LOD'da okunur.

### G3 — Dinamik dünya görünümü

- [x] Nüfus, kapasite ve fiziksel yapılardan türeyen şehir ayak izi.
- [x] Temel → iskelet → işletme inşaat görünümü.
- [x] Hasarlı/kapalı/onarılan altyapı segmentinin yerel görsel durumu.
- [x] Yangın, yıkım ve iyileşme görsel yaşam döngüsü mekanik durumla birebir.
- [ ] Ormancılık, tarım, maden ve sanayi yaşam döngüsü yalnız görünür değil,
  oyuncu eylemi → izin → fiziksel dönüşüm → ekonomik çıktı zinciriyle çalışır.

### G4 — Hareketli lojistik ve seyahat

- [x] Tır, tren ve gemi yalnız gerçek `ShipmentV2/TransportAgentV1` için görünür.
- [x] Araç kanonik kara/deniz/ray zincirinde ilerler; teslimatla uzlaşır.
- [x] Aktarma terminali, bekleme, yükleme/boşaltma ve tıkanıklık görsel geri
  bildirimi gerçek kuyruk durumundan okunur.
- [x] Karakter seyahati gerçek rota, ETA ve araç bağına geçtiğinde aynı hareket
  katmanında görünür; öncesinde sahte karakter aracı çizilmez.

### G5 — 2010–2100 dönem ve teknoloji görünümü

- [x] Beş dönem kimliği ve açık `PERIOD_ASSET_MISSING` fallback teşhisi.
- [ ] Her dönem için şehir, sanayi, altyapı ve taşıt farkı mekanik kurulum
  aşamasıyla seçilebilir; seçici hazır, dönem paketlerinin sanat üretimi eksik.
- [x] Eksik dönem paketi sessizce modern görünmez; QA ve geliştirici teşhisinde
  sayılır.
- [x] Katalog genişlemesi önce seçici/test, sonra atlas kuralını izler.

### G6 — Oyuncu etkileşimi ve bilgi mimarisi

- [x] Altıgen, şehir, ilçe ve tesis seçimi sağ Bölge dosyasına bağlanır.
- [x] Şehirden mevcut şehir yönetimi paneline girilir.
- [x] Altyapı güzergâhı, imar hedefi ve ilerleme haritadan seçilebilir.
- [x] Hover/tıklama hedefleri kamera hareketinde kaymaz; tooltip titremez
  (24 kamera adımı: 0 bölge/altıgen kaçırma, 0 px dönüş hatası).
- [x] Bölge dosyası seçili varlığın sahibi, çalışanı, kapasitesi, durumu,
  bağlantısı ve yetkili eylemini veri uydurmadan gösterir.
- [x] Orman, açık arazi ve maden altıgenleri kalıcı koruma/ormancılık/temizleme,
  tarım/enerji ve jeolojik etüt kayıtları açabilir.
- [ ] Açık etüt kayıtları kurum onayı, finansman, inşaat ve çevresel dönüşüm
  motoruna bağlanır; şu an kayıt açmak araziyi sihirli biçimde değiştirmez.

### G7 — Performans ve bellek

- [x] Statik şehir ve ağ katmanları kalıcı RAM bitmapleridir.
- [x] Kamera sürüklenirken şehirler görünür; bırakınca sonradan doğmaz.
- [x] Gerçek Electron'da uzak/orta/yakın/etkileşim p95 `<=16,7 ms`
  (21.08.2026 son aday: 12,2 / 14,6 / 12,1 / 13,7 ms).
- [x] Sürükleme ve zoom sırasında canlı şehir yeniden üretimi `0`, hit-test
  hatası `0 px`, `MAPTEST_PROBLEMS []`.
- [x] 30 dakikalık gerçek Electron/GPU harita soak'ında sürekli bellek büyümesi,
  donma veya renderer çökmesi yok (1.826 sn / 60 örnek; JS heap tek kapasite
  artışından sonra `50,4 MB`'da sabit, toplam büyüme `10.800.000 B`; Chromium
  çalışma seti büyümesi `8.908.800 B`, en kötü p95 `12,0 ms`, şehir/doğal
  katman kimliği ve üretim sayıları `1`, sorun listesi boş).

### G8 — Görsel ve regresyon kabulü

- [x] 1280×720, 1920×1080 ve 2560×1440'da uzak/orta/yakın kanıt karesi.
- [ ] Aynı viewport/state ile hedef 2B görsel ve uygulama yan yana incelenir.
- [x] Şehir yoğunluğu, İstanbul Boğazı, dağ zinciri, ada/liman ve altyapı
  kavşağı için odak kontrolleri geçer.
- [ ] `../../ux/qa/design-qa.md` aktif 2B sonucu `passed` demeden 2B tamamlandı denmez.

Son mühendislik adayı kanıtı:
`qa-runtime/story-map-2d-final-candidate` ve
`qa-runtime/story-map-soak-30m-final.json`. Teknik G0–G7 kapıları kapalıdır;
G8'in kalan iki maddesi kullanıcının hedef görselle son kabul kararına ayrılmıştır.

## 21.08.2026 oyuncu kabul turu — yeniden açılan kapılar

Kullanıcı 2B haritayı henüz tamamlanmış saymadı. Bu karar G2, G3, G5, G6 ve G8'i
yeniden açar; önceki teknik başarılar silinmez ancak görsel/oynanış kabulü yerine
geçmez.

- [x] Liman, kanonik kara-su komşuluğundan görünür raster kıyı kesişimine
  bağlandı; tarihî gemi atlası yerine modern terminal atlası kullanılıyor.
- [x] Kış kaplaması kuzeye/enleme bağlı ve mevsim/takvim anahtarlı; şehir
  iklim atlası yalnız kışın boreal görünüme geçiyor.
- [x] Karma kara-su altıgeni düz yeşile düşmeden kendi biyom zeminini koruyor.
- [x] Aynı fiziksel hattın ters yönleri için araç açısı 180° karşıtlık testi var;
  tır, tren ve geminin atlas ileri ekseni ayrı kalibre ediliyor.
- [x] Eski çift çizim yolu kaldırıldı; her fiziksel kara segmenti bir kez
  çiziliyor. Orman hücresi yeni kara/ray güzergâhına kesin kapalıdır; aday
  onayı ve devreye alınan fiziksel zincir aynı doğal-örtü kuralını kullanır.
- [x] Tesis seçimi tür, işleten, kapasite, durum ve mülkiyeti; maden altıgeni
  kaynak türü, faal kapasite, bağlı şehir ve biliniyorsa sahibi gösteriyor.
- [x] Gerçek Electron akışı zamanı UI'dan başlatıp durduruyor, fiziksel sevkiyat
  oluşturuyor, orman etüdü açıyor ve orman/maden dosyalarını ayrı kanıtlıyor.
- [ ] Mevsim katmanının son sanat kabulü: kuzeyde kademeli kar okunmalı fakat
  tekrar dokusu/şehir varlıkları boğulmamalı.
- [ ] Ana faz teknoloji ve bina çeşitliliği seçicileri erkene alınarak 2010–2100
  için yüzlerce seçilebilir tesis/şehir/altyapı varyantı üretilmeli.
  İlk ölçülü dilim bağlandı: gerçek PhysicalSiteV1.sectorId kullanan tarım,
  enerji, maden, sivil sanayi, ileri teknoloji ve savunma sanayisi tesisleri
  artık altı ayrı atlas hücresidir. Manifest 90 → 96 oldu. Bu madde kapanmadı;
  beş sanat dönemi, yapı kademeleri ve bölgesel varyantlar hâlâ açık borçtur.
- [ ] Orman kaldırma/koruma/ormancılık, tarım işletme ve maden çıkarımı açık
  kayıttan gerçek kurumsal karara ve fiziksel altıgen dönüşümüne ilerlemeli.
- [ ] Son FPS kabulü sakin makinede tekrarlanmalı. Aynı kodun önceki canlı
  turu uzak/orta/yakın/etkileşim p95 `13,1/14,7/14,7/13,0 ms` ve
  `MAPTEST_PROBLEMS []` verdi; yoğun arka plan yükündeki orman-yasağı turu
  başlangıçtan itibaren yaklaşık 2× yavaşladı ve performans kapısında
  `35,5/29,8/29,3/28,3 ms` verdi. İşlevsel sonuçlar, sevkiyat ve altıgen
  eylemleri geçti; bu ikinci ölçüm performans kabulü değildir.

## Tamamlanma tanımı

“2B motor tamamlandı” demek G0–G8 kapılarının geçmesi demektir. Bu ifade tüm
2010–2100 sanat kütüphanesindeki nihai binlerce varyantın üretildiği anlamına
gelmez. Yeni teknoloji, bina, savaş veya karakter seyahati mekaniği geldikçe
aynı kayıt/atlas sözleşmesine yeni seçilebilir paket eklenebilir; temel renderer
yeniden yazılmaz.
