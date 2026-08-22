# KARŞI-TAKTİK AI — rakibi okuyup karşı-plan kuran katman

**Durum:** planlanıyor (2026-08-19). Uygulama, açık maliyet kuyruğu bittikten sonra.
**Kullanıcının tanımı:** *"rakibin hareketlerinden taktiğini çıkarıp 'şunu yaparsam yenerim'
diyen bir şey lazım. Oyuncular karşıda gerçek bir profesyonel komutan olduğunu düşünsün,
basit taktiklerle AI'yı kandırıp kendini avutamasınlar."*

---

## Zincir ve nerede kopuyor

```
gözlem → İNANÇ → taktik sınıfı → karşı-plan → kalibre kazanma tahmini
     VAR ama KAPALI   ✔ YAZILDI      ✘ YOK        ✘ YOK
```

**2026-08-20 ilerleme:** `battleTaktikTespit()` yazıldı (js/globals.js) ve ilk şeması
`STANDOFF_ATIS` ölçüldü — `tools/taktik-tespit-olcum.js`, iki koşul aynı tohumda
(maviye dolaylı ateş zorlanmış vs tamamen çıkarılmış):

| koşul | tespit oranı | ort güven | ilk tespit |
|---|---|---|---|
| STANDOFF | %38,5 | 0,936 | tik 120 (6sn) |
| KONTROL | **%0,0** | — | — |

**Yanlış alarm sıfır**, şema başladıktan 6 saniye sonra yakalıyor. Ham oranın düşük
görünmesi paydadan: mavinin ateş etmediği anlar da sayılıyor, şema aralıklı uygulanıyor.
Karşı-plan tetikleyicisi için asıl ölçüt yanlış alarm + gecikme, ikisi de iyi.

**İnanç katmanı var — ama VARSAYILAN KAPALI.** ⚠ Bunu ilk yazdığımda "çalışıyor" demiştim,
yanlıştı: `js/globals.js:436` → `BATTLE_INTEL4_DELTAS = { ..., profile: false, ... }`.
Yani `updateThreatProfile` hiç koşmuyor. İlk tespit ölçümümde **0/41** çıktı ve sebep buydu.

Açıldığında çalışıyor: forensik çıkarım ("beni ne vurdu, hangi sınıf, nereden"), determinist,
sınıflar `areaAlpha / air / infiltrator / recon`, her sınıf için
`{detected, confidence, estPos, sourceIds}` ve kaynak birimler teyitli ölene dek kalıcı.
Kendi yorumu: *"Davranış-nötr (Faz A) — yalnız inanç+telemetri."*
Yani AI rakibi okuyabilir ama **ne okuyor ne de okuduğuyla bir şey yapıyor.**

`BattleSituation.js:395` bu profili `threatProfile` olarak taşıyor — yani veri planlama
katmanına **ulaşıyor**, orada kullanılmıyor.

## Elde hazır olan diğer parçalar

| parça | yer | durum |
|---|---|---|
| forensik inanç | `js/BattlePerception.js` `updateThreatProfile` | çalışıyor, davranış-nötr |
| sömürü arayıcı | `tools/somuru-arama.js`, `tools/somurucu-havuz.js` | çalışıyor |
| sömürücü davranışlar | `js/BattleExploiters.js` | çalışıyor |
| değer ağı | `js/BattleValueNet.js` | ρ 0,86 durum değerinde |
| maç kapısı tezgâhı | `tools/rol-dengesi-paralel.js` | çalışıyor |

**Ölçülmüş gerçek:** sömürü kompozisyonda değil **davranışta**. 19 aday / 32 maç taramasında
kompozisyon sömürüsü bulunamadı, ama **tek bir davranış botu AI'nın sağkalımını
%48,7 → %36,4** düşürdü. Yani "basit taktikle kandırılma" bu depoda somut olarak var.

## Eksik üç halka — bağımlılık sırasıyla

### 1. Taktik sınıfı (rakibin şeması)

Forensik "beni havan vurdu" diyor; gereken *"rakip **mesafede durup dolaylı ateşle yıpratma**
şeması uyguluyor"*. İyi haber: bu şemanın verisi ve etiketi **elimizde** — kullanıcının 4
gerçek maçından ölçüldü (`../reports/OYUNCU-MACLARI-BULGULAR.md`):

- oyuncunun dolaylı isabeti 490, AI'nın 207 (2,4×)
- AI birim başına oyuncunun **2 katı** panikliyor (3,1 / 1,5)
- AI'nın kısa menzilli birimleri düşmana ortalama 2,79× menzil uzakta

### 2. Karşı-plan — ve bu MÜFREZE seviyesini zorunlu kılar

"Mesafede topçuyla yıpratma"ya karşı-plan, birim başına *"nerede durayım"* sorusuyla
kurulamaz. Karşı-plan bir **manevra nesnesidir**: *topçuyu bul → hızlı kanattan bas →
kalanı dağıt.* Bugünkü aramada böyle bir nesne yok; arama tek birimin 15 saniyelik
konumunu seçiyor. Müfreze soyutlaması bu yüzden "iyi olurdu" değil **zorunlu halka**.

### 3. Kalibre kazanma tahmini

*"%90 yenerim"* bir **kalibrasyon** iddiasıdır: %90 dediğinde 10 seferin 9'unda kazanmalı.
Ölçütü var (güvenilirlik eğrisi / Brier skoru) ve maç tezgâhı bunu ölçebilir.

⚠ **Bugün öğrenilen kritik sınır** (`../research/OLCUM-TUZAKLARI.md` 9. tuzak): değer ağı, bir
birimin 5-6 hedef noktasını sıralamada **rastgeleden iyi değil** (ilk-1 %10,8 vs taban %18,
n=55). Sebep kategorik — adaylar birbirinden tek birimin yürüyüşü kadar farklı, global
durum değeri bu farkla değişmiyor.

**Ama bu, karşı-plan sorusunu kolaylaştırıyor:** planlar birbirinden çok daha kaba farklarla
ayrılır. Ağın başarısız olduğu sorudan kategorik olarak daha kolay bir soru. Yine de
**varsayılmayacak, ölçülecek** — rastgele tabana karşı.

## "Kandırılmasın" ayrı bir mekanizma — zekâyla gelmiyor

Her akıllandırma yeni bir sömürü yüzeyi açar. Elde etme yolu döngüdür:
**sömürüyü sen ara, bul, kapat.** (AlphaStar'ın ligindeki "exploiter" ajanlarının işi buydu.)

Somut hedef: sömürü havuzunu **sürekli koşan bir kapıya** bağla — her sürümde koştur,
AI'yı eşikten fazla düşüren bir davranış bulunursa **sürüm geçmez**. Arayıcı zaten yazılı;
eksik olan kapı disiplini.

## İlk adım — tek taktik-karşıtaktik çifti, uçtan uca

Zinciri baştan sona kurmak haftalar. Ama **tek bir çift** uçtan uca kurulabilir ve
mimarinin çalıştığını kanıtlar (ya da ucuza yanlışlar):

**Tespit:** "menzilim dışından dolaylı ateşle bastırılıyorum"
— üç girdi de zaten telemetride: bastırılma oranı · vuran silah sınıfı (forensik) ·
mesafe/menzil oranı.

**Karşı-plan:** topçu avı önceliği + dağılma + kapatma hamlesi.

**Kapı:** bu davranışı uygulayan bir **sömürücü bota karşı** A/B. Sömürücü var, kapı var,
ölçü var. Geçerse elimizde *"inanç → sınıf → karşı-plan → ölçülmüş kazanç"* zincirinin
çalışan bir örneği olur; sonrası aynı kalıbı çoğaltmak.

## Bu katmanı kurarken uyulacak ölçüm kısıtları

- Maç marjı std'si **2600-3800** → n=128'de saptama tabanı ~700-900. Karşı-plan kazancı
  bunun altındaysa **tek maç kapısıyla görülemez**; mekanizma metrikleri (tespit isabeti,
  karşı-plan tetiklenme oranı) ayrıca ölçülmeli.
- Tespit doğruluğu **rastgele tabana karşı** raporlanmalı (9. tuzak).
- Mekanizma kapısı, maç kapısının ölçeceği **aynı rolü** kurmalı (8. tuzak — `_menzileGir`
  bu yüzden yanlış yorumlandı).
- AI-vs-AI kapısı oyuncunun tarzını üretmez; karşı-taktik kapıları **sömürücü bota karşı**
  kurulmalı, doğal AI'ya karşı değil.

---

# 2026-08-20 — ZİNCİRİN İLK İKİ HALKASI ÖLÇÜLDÜ

## Halka 1 — TESPİT: **GEÇTİ**

`tools/taktik-tespit-olcum.js`, 6 tohum, iki koşul aynı tohumda (maviye dolaylı ateş
zorlanmış vs tamamen çıkarılmış):

| koşul | örnek | tespit | oran | ort güven | ilk tespit |
|---|---|---|---|---|---|
| STANDOFF | 237 | 180 | **%75,9** | 0,917 | tik 120 (6,0sn) |
| KONTROL | 194 | 0 | **%0,0** | — | — |

194 kontrol örneğinde **tek yanlış alarm yok**. Ayrım 75,9 puan. Kabul ölçütü ham tespit
oranı değil *yanlış alarm + gecikme* idi; ikisi de fazlasıyla iyi.

Konum kestirimi de ölçüldü (`tools/karsi-plan-teshis.js`): çıkarılan kaynak (2689, 2889)
— mavinin gerçek dolaylı-ateş birimlerinin merkezi (2385, 2873). Hata 150-300px. Nişan
almak için fazlasıyla yeterli.

## Halka 2 — KARŞI-PLAN: **ÜÇ KATMANDA DA ÖLÜ KANAL BULUNDU**

Karşı-planı bağlamak için üç ayrı katman denendi. Üçünün de sonucu ölçüldü:

| deneme | katman | sonuç |
|---|---|---|
| 1. ana-çabayı çıkarılan sektöre çevir | `assignSectors` | **yapısal NO-OP** |
| 2. nişanı çıkarılan kaynağa çevir | `planningContractDestination` | **ölü kanal** |
| 3. doğrudan hareket emri | `coordinatedContractOrder` | kanal açıldı, davranış değişti |

**1) Sektör NO-OP.** Sektörler x-bandı (`left/center/right`, WORLD_W/3). Çıkarılan topçu
zaten ana-çabanın bandındaydı (`center`); iki kolda `mainSector` hep aynı çıktı. Kod
zaten bunu yazıyordu (*"bu harita tek-eksenli cephe-çatışması"*) — asıl boşluk **y**'de:
kırmızı y≈1150→1800, topçu y≈2889.

**2) Nişan ölü kanal.** Nişan bir maçta **88 kez** çıkarılan kaynağa çevrildi
((2310,1529) → (2677,2943)) ve maç **birebir aynı** çıktı. Sebep `js/BattleExecution.js`:

```js
const point = contract.groupRole === TASK_GROUP_ROLE.FIRE_SUPPORT
    ? contract.destination : contract.route?.[0];
```

`destination` yalnız FIRE_SUPPORT dalında okunuyor. Dahası, ondan da önce: görünür temas
varsa grup ona saldırıp **`return`** ediyor — rota hiç okunmuyor.

### ⭐ ASIL BULGU — plan belgesinin teşhisi düzeltiliyor

Bu belge "karşı-plan **müfreze soyutlamasını** zorunlu kılar" diyordu. Ölçüm bunu
düzeltiyor: **müfreze soyutlaması zaten var** (task-group'lar, MAIN/FIXING/FLANK/RECON,
sektör, rol-başı derinlik kuralları). Eksik olan başka bir şey:

> **AI yalnızca GÖRDÜĞÜNE doğru hareket edebiliyordu.** Çıkarımdan (inanç) harekete giden
> bir kanal yoktu. Hareket, sektör-başına *görünür* temas odağından türüyordu.

Standoff şemasının işlemesinin sebebi tam olarak budur: perde birlikler görünür, toplar
görünmez. Rakip görünmeyen bir yerden vururken AI'nın elindeki tek "plan" görünen şeye
saldırmaktır. İnanç katmanı doğru cevabı **biliyordu** ama söyleyecek kanalı yoktu.

**3) Açılan kanal.** `coordinatedContractOrder` en başına karşı-plan baskını eklendi:
karşı-plan aktifken seçilen grup teması bırakır ve çıkarılan kaynağa yürür.

İlk ölçüm (n=3, `--kapsam mainflank`): baskın emri maç başına 4-9 kez çıkıyor, 3 tohumun
2'sinde yön doğru (mesafe −61/−103px, kuvvet ilerliyor, biri ilk kez topçunun 800px'ine
giriyor), 1'inde ters (+382px). **n=3 karar için çok küçük** — 10 tohumluk ölçüm koşuyor.

⚠ **GERİ ÇEKİLEN ARA İDDİA:** "FLANK grubu boş" demiştim — **yanlıştı**. Sektör-komuta
açıkken FLANK payı %15 ve ölçüm dalın gerçekten çağrıldığını gösteriyor (`cagri` 87/58).
Az emir çıkmasının sebebi başkaydı — aşağıdaki boğaz.

## Bayraklar (hepsi VARSAYILAN KAPALI — davranış değişmedi)

| bayrak | varsayılan | ne yapar |
|---|---|---|
| `BATTLE_KARSI_PLAN` | `false` | ana anahtar |
| `BATTLE_KARSI_PLAN_GUVEN` | `0.55` | tespit güven eşiği |
| `BATTLE_KARSI_PLAN_KAPSAM` | `'flank'` | baskını kim yapar (`flank` / `mainflank`) |
| `BATTLE_KARSI_PLAN_KAPAT` | `false` | yayılma yerine konsantrasyon (ayrı ölçüldü, **zararlı**) |
| `BATTLE_KP_TELEMETRI` | `null` | sayaç kancası (null = sıfır maliyet) |

⚠ Karşı-plan **inanç katmanına bağımlı**: `BATTLE_INTEL4_DELTAS.profile` varsayılan
`false`. Kapalıyken bayrak açık olsa bile sessiz no-op. A/B kurarken profile **her iki
kolda** açık olmalı; yoksa ölçülen şey karşı-plan değil "inanç katmanını açmak" olur.

## Sıradaki

1. 10 tohumluk mekanizma ölçümü (koşuyor) — mesafe/bastırma/dolaylıÖlü.
2. Yön doğrulanırsa: baskın **sürekliliği** (şu an emir tek seferlik, durum makinesi
   birkaç tik sonra tekrar görünür temasa dönüyor) — kalıcı görev durumu gerekiyor.
3. Sonra maç kapısı, ve **sömürücü bota karşı** (doğal AI'ya karşı değil).


## Halka 2 — SONUÇ: **KAPI GEÇİLMEDİ** (ama sebebi ölçüldü)

### Önce bulunan boğaz: baskın kendi altındaki dal tarafından eziliyordu

Sayaclar (tek maç): dal **274** kez çağrıldı, **265**'inde (%97) `shouldRefresh` boğazladı,
yalnız **9** emir çıktı. Boğazlanan çağrılarda akış aşağı düşüyor ve oradaki saldırı dalı
**daha kısa** yenileme aralığı kullandığı için grubu anında görünür temasa geri koşuyordu.
Düzeltme: baskın aktifken grup başka emir almaz (`return null`). Emir sayısı 9→23'e çıktı.

⚠ **Salinim hipotezi ÇÜRÜTÜLDÜ.** "Tespit sönüyor, baskın kalkıyor" diye düşünüp
taahhüt kilidi (30sn) ekledim; `baskinEmri` sayıları **birebir aynı** kaldı (7/4/4/3).
Tespit zaten zamanın %82'sinde aktifti — sınırlayan o değildi.

### Nihai ölçüm (n=10, kapsam=mainflank, sahiplenme + taahhüt)

| metrik | fark (açık − kapalı) | t | okuma |
|---|---|---|---|
| kaynağa mesafe | +29 px | 0,49 | **kapatma yok** |
| bastırma | −7,0 puan | −2,24 | anlamlı, yön doğru |
| ölen mavi dolaylı | +0,10 birim | 0,25 | **topçu sökülmüyor** |
| maç marjı | −105 TL | −0,10 | maliyeti de yok |

Kanca 10/10 tetikledi, kapalı kolda 0/10. Yani **bağlantı sağlam, manevra başarısız**.

### Neden başarısız — ve doğru cevap

Topa yürümek bu motorda kaybediyor: kaynak düşman hattının **arkasında**, oraya yürüyen
kuvvet hatta ölüyor (kanat-only kolda hayatta kalan kırmızı kütlesinin y'si 1720→925,
yani neredeyse başlangıç hattına düşüyor). Kod bunu zaten bir yerde yazıyordu:
*"Erime maneuver-değil CEPHEDEN-SÖMÜRÜ sorunu."*

Gerçek dünyada standoff'un cevabı yürümek değil **karşı-batarya ateşi**dir. Ve burada
aynı mimari boşluk **ateş katmanında** da çıktı:

> Mevcut karşı-batarya (`BATTLE_KARSI_BATARYA_HERKES`) yalnız **temas listesindeki**
> düşmana hedef-puanı bonusu veriyor. Standoff'ta toplar temas **değil**. Eski deneyin
> "etki yok" çıkmasının sebebi buydu: bonus hiç aday bulamıyordu.

**AI yalnız gördüğüne yürüyebiliyor VE yalnız gördüğüne ateş edebiliyor.**

### Sonraki iş: NOKTAYA ATEŞ GÖREVİ (dürüst sürüm)

`executionAttackOrder` **kimlikle** çalışıyor (`targetId`) ve `applyBattleOrder`'daki ATTACK
dalında **görünürlük denetimi yok**. Yani forensik `sourceIds`'e ateş emri vermek
teknik olarak şu an mümkün — **ama yapılmayacak**: bu, AI'ya görmediği birimi kusursuz
nişanlama verir, yani hile olur. Kullanıcının hedefi "karşıda gerçek bir komutan" hissi;
hile bunun tam zıddı.

Dürüst sürüm: **noktaya ateş görevi** — `estPos`'a, kendi 150-300px hatasıyla. Bu yeni bir
emir türü demek (replay + lockstep'ten geçmesi gerekir) ve asıl değeri şu: mimari boşluğu
**genel olarak** kapatır — AI ilk kez "bildiği ama görmediği" bir yere karşılık verebilir.


---

# 2026-08-20 (2. tur) — KARSI-BATARYA DENEMESI: **IKI IDDIA GERI CEKILDI**

## Geri cekilen 1: "dusman topcusu HIC hedeflenmiyor (%0,0)"

Bu, 4 tohumda (145000-145003) olculmustu ve **8 taze tohumda (146000-146007)
tekrarlanmadi**: ayni taban kolunda hedeflenme **%9**. Yani "hic" degil, "az".
Kusur gercek ama buyuklugu abartilmisti — bu depoda defalarca yasanan kucuk-n hatasi.

Ayrica ilk olcumun kendisi bir normalizasyon kusuru tasiyordu (bkz. asagida).

## Geri cekilen 2: "karsi-batarya mevzisi mekanizma kapisini gecti"

Ilk okuma (4 tohum, kusurlu normalizasyon): menzilde +39.7 · gozcu +44.3 ·
**KILITLI +25.9 puan**. Bu sonuc **gecersiz**.

Duzeltilmis olcum (8 taze tohum, ortak-kova normalizasyonu):

| metrik | kapali | acik | fark |
|---|---|---|---|
| menzilde | %48 | %59 | +11,2 puan |
| gozcu | %29 | %46 | +16,4 puan |
| **hedeflenmis (KILITLI)** | **%9** | **%2** | **-6,8 puan** |
| topcu bosta | %33 | %28 | -5,0 puan |
| olen dusman topcusu | 5/48 | 4/48 | **-1** |
| mac suresi | 97sn | 149sn | **+52sn** |
| marj | -674 | -1196 | -522 TL |

Topcu menzile **giriyor** (menzilde ve gozcu ikisi de yukseliyor) ama **daha az ates
ediyor** ve dusman topcusunu **daha az olduruyor**. Ustune mac 52sn uzuyor.

**Muhtemel sebep (olculmedi):** ates-destegini karsi-batarya mevzisine cekmek, ana
taarruzu destegisiz birakiyor; taarruz duruyor, mac uzuyor, ve ileri cikan topcu
menzile girse bile daha kotu durumda ates ediyor.

## Normalizasyon kusuru (13. tuzak)

Karsi-plan macin **suresini** degistiriyor (97 -> 149sn). Oran metrikleri ornek-basina
hesaplandigi icin **payda degisiyordu**. Once acik kol tam sureye gitti ve oranlar sahte
**dustu**; sabit pencere konunca bu sefer kapali kol pencereden once bitti ve oranlar
sahte **yukseldi**. Ikisi de gercek degil.

Cozum: ornekler 300-tiklik kovalara yazilir, ozet yalniz **iki kolun da ornek verdigi**
kovalari toplar. Sonuc metrikleri (olen topcu, marj, sure) tam mactan alinir.

## Zincirin guncel durumu

| halka | durum |
|---|---|
| gozlem -> INANC | calisiyor (varsayilan KAPALI: `BATTLE_INTEL4_DELTAS.profile`) |
| inanc -> TAKTIK SINIFI | **GECTI** — %75,9 tespit / %0,0 yanlis alarm / 6sn gecikme |
| taktik -> KARSI-PLAN | **UC DENEME, UCU DE BASARISIZ** |
| karsi-plan -> kalibre kazanma tahmini | baslanmadi |

Basarisiz uc deneme: (1) kanat/kutle baskini — topa yurumek kaybediyor;
(2) derin nisan — olu kanal; (3) karsi-batarya mevzisi — hedeflenme dusuyor, mac uzuyor.

**Ayakta kalan gercekler:**
- Tespit kaliteli ve ucuz. Sorun tespit degil, tespitin ARDINDAN ne yapilacagi.
- Kirmizinin topcusu zamanin **%33'unde bosta** (hedefsiz READY). Bu, karsi-plandan
  BAGIMSIZ bir kusur ve hala acik.
- Gozcu kurali %29 saglaniyor ama hedeflenme %9 — arada **20 puanlik** hedef-onceligi
  boslugu var (karsi-plan bunu kapatmadi, buyuttu).

**Tum `BATTLE_KARSI_PLAN*` bayraklari VARSAYILAN KAPALI kaldi** — oyunun davranisi bu
turda da degismedi.
