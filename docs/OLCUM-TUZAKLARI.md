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
