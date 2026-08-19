# ÖLÇÜM TUZAKLARI — her ölçümden ÖNCE okunacak kontrol listesi

**Neden var:** aynı hata sınıfı bu projede birden fazla kez tekrarlandı (26 birimi tek orduya
zorlamak → `zorunlu`-only tarif; `--pro` açıp kapamak → `--nospotter` eksikliği). Hata yapmak
sorun değil; **aynı hatayı iki kez yapmak** ölçülebilir zaman kaybı. Bu liste her yeni teşhis/A-B
kurmadan önce gözden geçirilir ve her yeni tuzak buraya eklenir.

---

## A. KURGU (ordu / senaryo)

**A1 — Ordu gerçekçi mi?**
`zorunlu`-only tarif orduyu **doldurmaz**: `{ zorunlu: { mlrs: 2 } }` ile 6500₺'de yalnız 5 birim
kurulur, bütçenin çoğu harcanmaz ve *her* birim bozuk görünür.
→ **Kural:** teşhis tarifleri `qa-runtime/gercekci-taban.json` (gerçek `paylar`+`tipPaylari`)
üzerine kurulur; `zorunlu` yalnız sınanan birimi ekler.
*(Vaka: SAM "0 atış" → gerçekte 39; balistik "4/6 hiç ateş etmiyor" → gerçekte 0/6.)*

**A2 — Her birimi zorlamak ordu değildir.**
26 birimi tek 6500₺'ye sokmak "her tipten bir tane" üretir; kütle yoktur, MBT bile x0 getiri verir.
→ **Kural:** birim taraması normal ordularda yapılır; nadir birim normal ordunun içine 1-2 adet sokulur.

**A3 — Tarif seçimi ölçülen şeyi taşıyor mu?**
Balistiğin görüş sorunu `KESIF-balistik-1` (keşif-AĞIRLIKLI) tarifiyle ölçülünce "sorun değil"
çıktı; normal orduda tam tersi. → **Kural:** ölçtüğün değişkeni tarif zaten sağlıyorsa sonuç
kurgunun kendisidir. Tarif içeriğini ölçümden önce yazdır.

**A4 — Teşhis, düzeltmenin ÇALIŞACAĞI yapılandırmada mı yapılıyor?**
`resupplyRun` pro-KAPALI ölçüldü (%19 kuruluk) ama delta pro-AÇIK'a bağlandı; pro'da sorun zaten
%0.1-3.9'du. → **Kural:** teşhis, deltanın koşacağı bayrak setiyle yapılır.

**A7 — Tarif/ordu YALNIZ BİR TARAFA mı uygulandı?** *(2026-08-07, aynı gün İKİ kez)*
Hava-hava mekanizmasını ölçerken tarif yalnız MAVİYE verildi; kırmızıda tek silahsız keşif İHA'sı
vardı → "kilit %0.4" çıktı ve mekanizma **hiç sınanmamış** oldu. Aynı gün ikinci vaka: hedef-uygunluk
ölçümünde MAVİ ordusu `battleDeployManifest` ile HİÇ kurulmadı → kırmızı 12/12 kazandı, marj 6428.
→ **Kural:** her ölçüm, **her iki tarafın** kadrosunu (birim sayısı + sınanan tipin adedi) BAŞLIKTA
yazdırır. Kırmızı için `BATTLE_RECIPE_RED`, mavi için `battleDeployManifest(..., { ally: true })`.
Bağlanma kanıtı görünmeden tablo okunmaz. *(Bkz. B2 — aynı kuralın delta tarafı.)*

**A8 — Sayaç AÇIK mı? (`BATTLE_BALANCE.on`)** *(2026-08-08)*
"Terk edilen araç HİÇ ele geçirilmiyor (19 teslim, 0 kapma)" diye bir teknik borç kaydedildi.
Sonra doğrudan bayrak değişimi izlendi: mekanizma **ÇALIŞIYOR** — tik 767'de tank avcısı (hp 234/234)
ve tik 2081'de SPAAG (hp 172/171) gerçekten el değiştirdi. Sayaç `BATTLE_BALANCE.captured` ise
`BATTLE_BALANCE.on` kapalı olduğu için hiç artmamıştı.
→ **Kural:** `BATTLE_BALANCE.*` alanlarını okumadan önce `.on` durumunu YAZDIR. Kapalıysa sayı
"olay olmadı" değil "sayılmadı" demektir. Mümkünse olayı **doğrudan** ölç (durum değişimini izle),
sayaca güvenme. *(Aynı sınıf: A5/A6 — araç sessizce bayrak değiştiriyordu.)*

---

## B. İZOLASYON (A/B kurulumu)

**B1 — Tek değişken mi değişiyor?**
`--pro` açıp kapamak TÜM deltaları birden değiştirir. → **Kural:** iki kolda da aynı bayrak seti;
yalnız sınanan anahtar toggle edilir (`--nostandoff`, `--noresupply`, `--nospotter` kalıbı).

**B2 — Toggle gerçekten bağlıyor mu?**
İki kol birebir aynı çıkıyorsa önce **bayrağın uygulandığını** doğrula: bind sayacı (`BATTLE_BALANCE.*Bind`)
sıfırsa kural hiç çalışmamıştır. Vakalar: (a) toggle araca eklenmemişti, (b) kural yalnız sezgisel
kurucuya konmuştu ama test tarif yolundan geçiyordu, (c) bayrak `openAIVsAILab` tarafından eziliyordu.
→ **Kural:** her yeni kural bir bind sayacı yazar; ölçüm önce onu raporlar.

**B3 — Global bayrak taraf ayırmaz.**
`BATTLE_SECTOR_COMMAND`, `BATTLE_INTEL4PRO_DELTAS`, `BATTLE_JAM_*` globaldir; kapatınca iki taraf
birden değişir ve fark kimseye atfedilemez. → **Kural:** A/B'ye girecek her şey taraf-başı olmalı
(`_RED`/`_BLUE`), yoksa önce o refactor yapılır.

**B5 — Aynı vm bağlamında iki kol koşturma (DURUM SIZINTISI).**
İki kolu tek `tezgahKur()` bağlamında art arda koşturdum; ilk kolda kapattığım
`BATTLE_INTEL4PRO_DELTAS.*` bayrakları ikinci kola **sızdı** ve "kural hiç çalışmıyor" sandım —
oysa çalışıyordu. → **Kural:** her kol KENDİ taze bağlamında koşar (ayrı süreç ya da yeni
`tezgahKur()`), veya kol başında tüm bayraklar açıkça yeniden kurulur.

**B4 — Doğru tabana karşı mı ölçüyorsun?**
Marj-kesmenin "%60 kazancı" `--erkendur`SİZ tam maça karşıydı; tezgâh zaten erkendur ile koşuyordu
ve gerçek kazanç sıfır çıktı. → **Kural:** taban = **varsayılan koşu yapılandırması**, teorik en kötü hâl değil.

---

## C. METRİK

**C1 — Metrik doğru amacı mı ölçüyor?**
"Ana-sektör oranı" makul, gürültüsüz ve ölçülebilirdi — ve maç sonucunu **TERS** tahmin etti
(yoğunlaşan savunan mekanizmada 3-8× iyi, maçta belirgin kötü).
→ **Kural:** her yeni metrik ailesi, ilk kullanımında **bir kez** maç kapısına karşı doğrulanır.

**C2 — Türetilmiş durum bayat olabilir.**
Jam oranı `combatState === 'Karıştırıldı'` ile ölçülünce %91 çıktı (hedef %75); durum bir sonraki
tikte üzerine yazılmıyordu. Kesin sayaçla (`_jamTik`) %74 oldu.
→ **Kural:** oran ölçümü türetilmiş durumdan değil, olayın kendi sayacından okunur.

**C3 — Ölü birim listeden silinir.**
Maç SONUNDA `SIM.units` taranırsa ölenler yoktur → "0/0 zırhlı" gibi saçma sonuç.
→ **Kural:** kadro başta kaydedilir, ölümler döngüde izlenir.

**C4 — Vekil metrik ≠ ekonomik sonuç.**
Atış sayısı, kapsama, maruziyet gibi mekanizma metrikleri kolay oynar; birim ekonomisine
(hasar/₺, ömür, imha değeri) dönüşmeyebilir. Bugüne kadar K1'i geçen becerilerin **yarısı** K2'de
elendi. → **Kural:** K1 geçmek "çalışıyor" demek değildir; K2 ayrı bir kapıdır.

---

**C5 — Tek sayı iki farklı olguyu topluyorsa hipotez üretir, kanıt üretmez.**
Helo "titremesi" için yön-tersine-dönme oranını 0.5px eşiğiyle saydım; bu metrik *mikro sarsıntı*
(ayırma itmesi, ~2px) ile *tam hızlı pinpon* (~30px) ayrımını yapmıyordu. Yanlış hipoteze
(hedef-referansı) götürdü; uyguladığım "düzeltme" oranı %82→%90 **kötüleştirdi**. Adım büyüklüğüne
göre ayırınca ve tik-tik iz alınca (`tools/helo-titreme-iz.js`) gerçek sebep 3 dakikada çıktı:
ayırma fiziği `loaded` yolcuyu elemiyordu, helo kendi kargosuyla itişiyordu.
→ **Kural:** bir metrik iki mekanizmayı toplayabiliyorsa önce onu ayrıştır. **Tik-tik iz almak
hipotez kurmaktan ucuzdur** — "hangi yazıcı eziyor" sorusu tahminle değil dökümle çözülür.

**C6 — Düzeltmenin ölçüsünü DÜZELTMEDEN önce al, sonra da AYNI kurulumda tekrarla.**
Ferry düzeltmesini 3 tohumda ölçüp "kargo ölümleri 6→0" dedim; 6 tohumda aynı ölçüm 8→12 çıktı
(oran %25→%27, yani değişmemiş). E3'ün somut tekrarı: 3 tohum kanıt değil, **hele de sayaç küçükse**.
→ **Kural:** birim-teşhisi sonucu rapor edilecekse en az 6 tohum; "sıfırlandı" gibi mutlak iddialar
yalnız oranla birlikte yazılır.

**A5 — Tarama aracının KENDİ kurgusu bulguyu üretebilir.**
`tools/birim-sagligi.js` tarif verilmediğinde sessizce `BATTLE_FORCE_VARIED = true` yapıyordu:
"her tipten biraz" ordusu → kütle yok, birimler ince yayılıyor ve **hepsi** sorunlu görünüyor.
Bu kipte IFV ömrü 57sn/getiri x0.1 çıktı ve "ordunun en büyük deliği" sandım; AI'nin GERÇEK
ordusunda aynı birim 228sn/x0.42. Tablodaki `ew_vehicle`/`counter_battery_radar` satırları da
ipucuydu — AI o birimleri normalde almıyor.
→ **Kural:** toplu tarama tablosunu okumadan önce **hangi orduyu kurduğunu** doğrula; karar
AI'nin gerçekten kurduğu orduda (`--cesitsiz`) verilir. A2'nin araç içine gömülmüş hâli.

**A6 — İki araç çelişirse önce KURGULARI karşılaştır, sonucu değil.**
Öncü teşhisi IFV için 228sn, sağlık taraması 57sn dedi. İkisi de doğruydu — farklı ordulardı.
→ **Kural:** çelişkide ilk soru "hangisi haklı" değil, **"aynı şeyi mi ölçüyorlar"**.

---

## D. SAYILAR VE SABİTLER

**D1 — Sabitleri yorumdan okuma.**
`globals.js` yorumu "TILE_PX=35" diyordu; gerçek değer **100**. Jam yarıçapını 400px sandım,
gerçekte 1143px (haritanın %2.9'u değil %23'ü). Aynı hata `aoe`'de tekrarlandı (×100 fazladan).
→ **Kural:** ölçüm aracı sabitleri **çalışan bağlamdan** okur (`STATS[...]`, `TILE_PX`), koda
gömmez ve yoruma güvenmez.

**D2 — Birim (px / kare / oran) karışıklığı.**
`weapons[].minRange` kare, `STATS[].minRange` px'tir. `aura.radius` kare, `× TILE_PX` gerekir.
→ **Kural:** yeni bir alan kullanmadan önce tek bir birimde değerini yazdır.

---

## E. İSTATİSTİK

**E1 — Tarama havuzu sahte pozitif üretir.**
Savunan dolaylı payı: tarama havuzunda %4 belirgin iyi görünüyordu (828 marj, "anlamlı");
ayrılmış FİNAL havuzunda fark **tamamen kayboldu**.
→ **Kural:** karar yalnız ayrılmış havuzda doğrulanınca verilir.

**E2 — Çoklu karşılaştırma.**
250 beceriyi tek tek %95 güvenle sınamak saf şansla ~12 sahte kazanan üretir.
→ **Kural:** maç kapısı bireysel beceriye değil demetlere uygulanır.

**E3 — Tek tohum kanıt değil.**
Kaotik simde tek maç sonucu iddiaya dönüştürülmez; marj std'si ~3114, ±1000 için 37+ tohum gerekir.
→ **Kural:** mekanizma için 1-3 tohum yeter, **sonuç** için 37+.

---

## F. SÜREÇ

**F1 — Uzun koşuyu başlatmadan önce hızı ÖLÇ.**
6.5 saat tahmin ettiğim turnuva, gerçek hız (0.17 maç/sn) yüzünden 50+ saatlik hâle geldi; sebep
belleğin dolup işçi tavanının 1'e düşmesiydi ve bunu 7 saat sonra fark ettim.
→ **Kural:** uzun koşunun ilk 10 dakikasında gerçekleşen hız ölçülür ve tahminle karşılaştırılır.

**F2 — Koşan ölçüm varken KOŞULSUZ kod değiştirme.**
`BATTLE_SPAWN_LOADED` turnuva koşarken indi; işçiler dosyaları her parçada yeniden yüklediği için
aynı turdaki adaylar farklı kurallarla ölçüldü. → **Kural:** koşan turnuva varken yalnız bayrak-kapılı
değişiklik yapılır; koşulsuz mekanik değişikliği turnuvayı geçersiz kılar.

**F3 — Sözdizimi kırığı sessizce her şeyi bozar.**
`DELTAS` nesnesinin kapanış `};`'ı yutulunca tüm deltalar tanımsız kaldı ve testler anlamsız çıktı.
→ **Kural:** her düzenlemeden sonra `node --check`.

---

## G. MOTOR TUZAKLARI (ölçüm değil, ölçülen sistemin kendisi)

**G1 — Bir düzeltme, uykuda duran başka bir hatayı UYANDIRABİLİR.**
Ferry düzeltmesi helolara gerçekten yük taşıttı; o güne kadar `cargo` çoğunlukla boş olduğu için
kapanmayan `cargo → yolcu → carrier → helo` **dairesel referansı** artık kapanıyordu ve
`battleForkCapture` (JSON tabanlı `replayClone`) çöküyordu. Oracle, replay ve fork tabanlı TÜM
ölçümler etkileniyordu; hata ancak yüklü helo içeren tohumlarda görünüyordu.
→ **Kural:** bir mekanik "artık gerçekten çalışıyor" hâle geldiğinde, o mekaniğe dokunan
**serileştirme/fork/replay** yollarını ayrıca sına. `--forktest` yeşil olması yetmez; kapının
kullandığı ordu o mekaniği içermiyor olabilir (bu vakada içermiyordu).
→ **Düzeltme kalıbı:** birim-referansı taşıyan alanlar snapshot'ta **kimliğe** çevrilir
(`attackTarget` zaten öyleydi; `cargo`/`carrier` unutulmuştu) ve restore'da tüm birimler
kurulduktan SONRA çözülür.

---

## H. GÖRSEL ÇEKİM TUZAKLARI (canvas / Electron)

**H1 — Gizli pencerede `capturePage` BAYAT kare döndürür.**
Sprite tabakası yenilendikten sonra "26 birim gerçekten çiziliyor mu?" sorusu
`show: false` bir `BrowserWindow` ile ölçüldü. Dört ayrı koşuda kare **piksel-aynı**
çıktı — oysa her koşuda sahadaki birim sayısı farklıydı (23/25/26/29). Oyunun kendi
ölçütleri de "26 birim görünür, 26'sı kamera içinde" diyordu. Yani sorun çizimde
değil, **alette**ydi: gizli pencerede `requestAnimationFrame` durur, `capturePage`
yükleme sırasında boyanmış önbellek yüzeyini geri verir.

Yanıltıcı olan şu: **harita boyanmış görünüyordu** (arazi, sis çizgisi, HUD hepsi
yerindeydi), bu yüzden "render çalışıyor, demek ki birimler çizilmiyor" sanıldı ve
iki tur boşuna çizim yolunda hata arandı (`drawFogOfWar`, `battleUnitVisibleToViewer`).

→ **Kural:** canvas içeriği ölçülecekse pencere **`show: true`** olmalı. DOM/panel
çekimleri `show: false` ile çalışır (layout'ta boyanır), canvas çalışmaz.
→ **Negatif kontrol:** iki koşunun karesi byte-aynı ise alet bayattır. Ölçümden önce
kasten değişen bir şey (birim sayısı, saat) karede görünüyor mu diye bak.

**H2 — Yerleşimi DÜNYA biriminde yazmak, `zoom≠1` iken izgarayı ekran dışına atar.**
Ekran = `(x - camera.x) * zoom`. `zoom` 0.38 iken dünya-biriminde 260px aralık
ekranda 99px'e düşer; tersi durumda izgara sağ/alt tarafa taşar.
→ **Kural:** teşhis amaçlı yerleşimi ekran uzayında hesapla, sonra dünyaya çevir.

**H3 — Konuşlandırma fazında rakip birim ÇİZİLMEZ.**
`Unit.draw` → `battleUnitVisibleToViewer` DEPLOY'da karşı tarafı gizler ("konuşlandırma
istihbarat değildir"). Teşhis için birim dizerken hepsini `myCanonicalSide` yap,
yoksa yarısı sebepsiz kaybolur.

---

## I. ROL/TARAF KURGUSU (kendi yazdığın tezgâhta)

**I1 — İki taraf AYNI kuralla kurulmalı; bayrak sırası bunu sessizce bozar.**
`tools/rol-dengesi.js` saldıran↔savunan dengesini ölçmek için yazıldı: iki tarafta da
aynı beyin, tek asimetri rol. Ama KIRMIZI (saldıran) ordu `openBattlefieldSession`
**içinde** kuruluyor; `BATTLE_FORCE_VARIED` bayrağı oturumdan SONRA açılınca saldıran
varied-*olmayan*, savunan varied-*olan* dağılımdan kuruldu. İki taraf farklı kurala
tabiydi ve bu, ölçüyü **8-13 puan** kaydırdı:

| | saldıran kazanma | marj |
|---|---|---|
| bozuk alet | %30.2 / %28.1 | −1321 / −1389 |
| düzeltilmiş | %38.5 / %41.7 | −833 / −602 |

Bozuk ölçüm "saldıran ezici biçimde kaybediyor" diyordu; gerçek tablo çok daha ılımlı.
→ **Kural:** ordu kuran her bayrağı, orduların kurulduğu çağrıdan **önce** ayarla.
Kurulum sonrası ayarlanan bayrak yalnız SONRAKİ tarafı etkiler.
→ **Negatif kontrol:** iki tarafın manifest'ini (birim dağılımı/değeri) yazdır ve
istatistiksel olarak aynı dağılımdan geldiklerini doğrula. Simetrik kurguda taraf-başı
ordu değeri sistematik farklı çıkıyorsa alet bozuktur, motor değil.

**I2 — Eşleştirilmiş A/B, kurgu hatasına DAYANIKLIDIR; mutlak oran değildir.**
Aynı koşuda `BATTLE_ISTIHKAM_US` açık/kapalı eşleştirilmiş farkı, alet bozukken de
düzeltildikten sonra da "anlamlı değil" verdi (t −0.29 → t 0.78). Çünkü kusur iki kolda
da vardı ve fark alınca sadeleşti. Ama aynı koşudaki MUTLAK saldıran oranı çöptü.
→ **Kural:** bir koşudan hem eşleştirilmiş fark hem mutlak oran okuyorsan, kurgu hatası
ikisini AYNI ölçüde bozmaz. Farkı kurtaran şey oranı kurtarmaz.

---

## Gece kuyruğu tuzakları (2026-08-18 — üçü de yaşandı, üçü de ölçümü sessizce bozabilirdi)

Uzun ölçüm kuyruklarını gözetimsiz koşarken üç ayrı hata çıktı. Hiçbiri sayıları
"yanlış" göstermez — **koşuyu hiç yaptırmaz ya da iki koşuyu üst üste bindirir**, ki
ikisi de fark edilmezse geceyi çöpe atar.

### 1. "node işlemi kalmayana kadar bekle" ASLA çalışmaz

Makinede sürekli ayakta duran node süreçleri var (MCP sunucuları). `node sayısı <= 1`
koşulu hiçbir zaman sağlanmaz → kuyruk 6 saat boş bekler ve hiçbir şey koşmaz.
Yakalanma sebebi şans oldu (süreç listesine bakıldı).

→ **Kural:** bekleme koşulu SÜREÇ SAYISI değil, önceki koşunun **log'a yazdığı bitiş
damgası** olmalı. Süreç sayımı ayrıca yanlıştır çünkü:
- ebeveyn `node tools/x.js` (göreli yol) ile başlatılınca komut satırında depo adı GEÇMEZ
  → `CommandLine -like '*pixel-rts*'` süzgeci ebeveyni KAÇIRIR
- kapılar arasında işçiler ölür, ebeveyn yaşar → sayım bir an sıfıra düşer ve bekleyen
  kuyruk ERKEN başlar (iki kapı aynı anda = işçiler CPU/RAM için dövüşür)

### 2. Koşan bir bash betiğini DÜZENLEME

Bash betiği bayt konumundan **artımlı okur**. Koşarken dosyayı düzenlemek, bekleme
döngüsünden çıktıktan sonra kaymış bir konumdan devam etmesine yol açar → ya çöp
çalıştırır ya sessizce çıkar. Bu gece bir kuyruk tam bunu yaptı: bekleme mesajını
yazdı, sonra hiçbir kapıyı koşmadan öldü.

→ **Kural:** kuyruk koşarken betiği düzenleme. Değişiklik gerekiyorsa **yeni dosya** yaz.

### 3. `TaskStop` torunları öldürmeyebilir

Durdurulan kuyruğun bash süreci saatler sonra hâlâ canlıydı ve bekleme döngüsünden
çıktı. Şansa zarar vermedi (düzenlenmiş dosya yüzünden çıktı) ama koşan bir kapıyla
çakışabilirdi.

→ **Kural:** kuyruk durdurduktan sonra süreç listesini **gözle doğrula** (ebeveyni
göreli-yol yüzünden kaçırmayan bir süzgeçle), sonra yenisini başlat.

### 4. `js/` dosyaları kuyruk koşarken DONDURULUR

Her kapı başlangıçta kodu yükler. Kuyruğun ortasında `js/` değiştirmek, B'nin X kodunda,
C'nin Y kodunda koşması demektir — tek bir kapının iç karşılaştırması bozulmaz ama
**kapılar birbiriyle kıyaslanamaz** hâle gelir ve bu çıktıdan GÖRÜNMEZ.

---

## Tarayıcı kapısı tuzakları (2026-08-18 — Worker'ı sınarken üçü de yaşandı)

### 1. Tarayıcı ÖNBELLEĞİ düzeltmeyi yutar

Kalıcı `--user-data-dir` ile koşan headless tarayıcı `js/*.js` dosyalarını önbellekten
verir. Motorda yapılan düzeltme sayfaya **hiç ulaşmaz** ve kapı düşmeye devam eder —
"düzeltme işe yaramadı" diye görünür ama ölçülen şey ESKİ koddur. Bu, gerçek bir
düzeltmeyi (JSON `-Infinity`) neredeyse geri aldıracaktı.

→ **Kural:** tarayıcı kapısı **her koşuda taze profille** açılır (`tools/tarayici-kapi-kos.js`
bunu yapar ve profili sonunda siler).

### 2. `--virtual-time-budget --dump-dom` asenkron kapıyı ölçemez

Sayfa işçiyi beklerken ana iş parçacığı BOŞTA kalır → sanal zaman anında dolar → DOM,
işçi cevap vermeden dökülür. Çıktı hep "yarım" görünür (bizde her seferinde "işçi HAZIR"
satırında kesiliyordu) ve bu bir **hata gibi değil, sonuç gibi** okunur.

→ **Kural:** asenkron tarayıcı kapıları CDP ile, `window.__KAPI_SONUC` dolana kadar
GERÇEK zamanda yoklanır.

### 3. "İşçi farklı davranıyor" demeden önce ANA TARAFI sına

Worker sapması günlerce işçiye yüklenebilir. Bizde kök neden motordaydı: aynı fork'tan
iki koşu ana iş parçacığında bile ayrılıyordu. Bunu gösteren tek satırlık ölçüm
(kendi kendine tutarlılık) teşhisi anında doğru yere çevirdi.

→ **Kural:** iki ortam karşılaştırılırken önce **her ortamın kendi içinde**
tekrarlanabilir olduğu ölçülür. Değilse karşılaştırma anlamsızdır.

---

## Ham kayıt / A/B tuzakları (2026-08-19 gecesi — dördü de yaşandı)

Bu geceki dört tuzağın ortak yanı: **hepsi "sonuç" üretti.** Hiçbiri hata vermedi, hepsi
okunabilir bir sayı bastı ve o sayı yanlıştı.

### 1. `const` ilan edilmiş global A/B'lenemez — kapı "fark yok" der

`LA_HALKA`, `LA_YON`, `LA_YARICAP` `const` idi. A/B tezgâhı kol değerini vm bağlamına
enjekte ediyor; `const`a atama ya patlar ya hiçbir şey yapmaz. İkinci halde **iki kol da
aynı değeri koşar** ve kapı "anlamlı değil" der — teknik olarak doğru, anlamca sahte.

**Karşı önlem (uygulandı):** `tools/rol-dengesi.js` kol atamasından sonra değeri **geri
okuyup** doğruluyor; tutmuyorsa maç sessizce değil gürültüyle düşüyor. Negatif kontrol:
hâlâ `const` olan `LA_YAYILIM_ESIK` ile kapı gerçekten düştü.

**Kural:** yeni bir knob'u A/B'ye sokmadan önce `let` mi diye bak; sonra 2 tohumluk bir
koşuyla iki kolun **farklı sonuç ürettiğini** gör. Aynı marj = knob ölü.

### 2. Telemetri alan adını anlamını bilmeden okuma (`navBlocked`)

`navBlocked` "birim takılı" sanıldı ve 4 maçta 16 birim "navigasyon tıkanıklığı" diye
etiketlendi. Alanın gerçek tanımı: **hedefe düz çizgi arazi tarafından kapalı**
(`pathBlockedBetween`). Birim engelin etrafından yürüyor olabilir — nitekim yürüyordu.
Gerçek takılma ölçüsü (uzak hedefi varken ardışık örneklerde <1,5px oynama) eklenince
kova **tamamen boşaldı**.

**Kural:** bir alandan teşhis üretmeden önce onu **yazan satırı** oku.

### 3. Genel bir alanı özel bir birime uygulama (`menzilimdeDusman` + hava savunması)

`menzilimdeDusman` menzildeki *her* düşmanı sayar. MANPADS/SAM karaya ateş edemez; menzilinde
bir tank varken "hedef seçmemiş" demek onu haksız suçlamaktır. Yalnız hava düşmanına göre
yeniden hesaplanınca bu birimler **doğru davranıyor** çıktı.

**Kural:** "X yapmıyor" demeden önce X'in o birim için **mümkün** olduğunu doğrula.
(Aynı sınıfın önceki örneği: silahsız radar/ikmal birimlerini "ateş etmiyor" diye saymak.)

### 4. Kuyruk, mekanizma kapısının sonucuna bakmıyordu

Kural şuydu: *mekanizma ölçümü geçmezse maç kapısı harcanmaz.* Kuyruk betiği bunu
uygulamıyordu — K0 ilk satırında çöktü, K1 (60 dakikalık maç kapısı) yine de başladı.
Kural belgede vardı, kodda yoktu.

**Kural:** disiplin cümlesi betikte `if` olarak görünmüyorsa, o disiplin yok.

### 5. Koşan bir bash betiğini düzenleme

Bash betikleri **artımlı** okunur: yorumlayıcı dosyada bir bayt konumu tutar ve sıradaki
komutu oradan okur. Betik koşarken dosyanın uzunluğu değişirse süreç, dosyanın ortasından
saçma bir noktadan devam eder. `--bekle` ile kuyrukta bekleyen bir faz betiğini
düzenlediğimde tam bu oldu; süreç öldürülüp yeniden başlatıldı.

**Kural:** kuyrukta bekleyen bir betiği düzenledikten sonra **öldür ve yeniden başlat**.
Düzenlemenin işe yaradığını varsayma.

### 6. Knob'u sevk edilmeyen konfigürasyonda ölçme

Tezgâhın varsayılanı `LA_UFUK=100`; oyuna sevk edilen değer artık 200. Yeni bir knob'u
tezgâh varsayılanında ölçmek, "ufuk 100 iken bu knob kazandırır mı" sorusunu cevaplar —
o soruyu kimse sormuyor.

**Kural:** yeni knob **sevk edilen** konfigürasyonda ölçülür. Tek istisna **tekrar**
ölçümleridir: onlar havuzlanacakları ölçümle aynı koşulda kalmak zorundadır.

### 7. Motor dosyasını kapılar koşarken düzenleme

Tezgâh süreçleri motor dosyalarını **başlangıçta bir kez** okur. Yani koşmakta olan bir
kapı etkilenmez, ama sonra başlayan kapı **farklı kod** koşar — aynı gecenin iki kapısı
kıyaslanamaz hale gelebilir.

**Kural:** kapılar koşarken yalnız **davranış-nötr** düzenleme yap (yeni bayrak varsayılan
kapalı, `const`→`let`, yorum). Davranışı değiştiren düzenleme kuyruk boşalınca yapılır —
ve nötrlük varsayılmaz, koşulun tezgâhta yürümediği **gösterilir** (örn. `BATTLE_LA_WORKER_KIP`
tezgâhta hiç açılmıyor, `js/BattleWorkerKopru.js` zincirde yok).

### 8. Mekanizma kapısı ile maç kapısı FARKLI ROLÜ ölçüyordu

`_menzileGir` mekanizma kapısı (M0) kuralı **AI savunurken** ölçtü ve "sonuç kötüleşiyor"
dedi (marj +2071 → −160). Ben buna bakıp maç kapısından negatif bekledim. Maç kapısı (M1)
**saldıranı** ölçtü ve **+748** çıktı (galibiyet %50,8 → %64,1).

İkisi de doğruydu: savunanın menzile yürümesi yanlış, saldıranın doğru. Ama iki kapı
**farklı soruyu** cevapladığı için mekanizma kapısı beni yanlış yönlendirdi.

**Kural:** mekanizma kapısı, maç kapısının ölçeceği **aynı rolü** kurmalı. Kurmuyorsa bunu
çıktısına yazmalı ki sonucu okuyan iki kapıyı aynı sanmasın.
