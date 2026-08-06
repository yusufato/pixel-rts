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
