# 25 BİRİM SAĞLIK RAPORU — hangileri bakılmamış, sorunları ne

**Tarih:** 2026-08-06 · **Araç:** `tools/birim-sagligi.js` · **Ölçüm:** 6 tohum, gerçekçi ordular,
`intel4pro` gövde (aktif beceriler: `standoff`, `heloHunt`)

**GETİRİ** = imha ettiği düşman değeri ÷ kendi maliyeti (forensik `attackerId`+`lethal` ile atfedilir).
x1.0 = kendi parasını çıkarıyor. **boşta** = mühimmatı varken menzilinde hedef olmayan tik oranı.

> **Kurgu notu:** ilk sürümde 26 birimin hepsi aynı 6500₺'ye zorlanmıştı → "her tipten bir tane"
> gibi anlamsız bir ordu çıkıyor ve MBT bile x0 görünüyordu. Düzeltildi: ordular NORMAL kurulur,
> nadir birimler normal ordunun içine 1-2 adet sokulur.

## Silahlı birimler (getiriye göre — kötüden iyiye)

| birim | ₺ | ATIŞ | hedefli | boşta | ömür | **GETİRİ** | tam-yükle öldü | bakıldı mı |
|---|---|---|---|---|---|---|---|---|
| **ballistic_missile** | 1050 | 1 | %100 | %0 | 365sn | **x0** | %0 | ✔ |
| **scout_vehicle** | 180 | 3.8 | %2 | %98 | 200sn | **x0** | %45 | ✗ |
| **engineer** | 200 | 0 | %2 | %98 | 177sn | **x0** | — | ✗ |
| **sam_battery** | 700 | 0.7 | %5 | %95 | 117sn | **x0.04** | **%67** | ✗ |
| **ifv** | 320 | 2 | %7 | %93 | **57sn** | **x0.10** | **%70** | ✗ |
| **artillery** | 450 | 6.6 | %51 | %49 | 92sn | x0.11 | %33 | ✔ |
| **mlrs** | 650 | 2.8 | %58 | %42 | 321sn | x0.15 | %0 | kısmen |
| attack_helo | 800 | 5.5 | %79 | %21 | 82sn | x0.28 | %0 | ✔ |
| infantry | 100 | — | %9 | %91 | 109sn | x0.31 | — | ✗ |
| manpads_team | 190 | 1.3 | %6 | %94 | 140sn | x0.33 | %20 | ✗ |
| armed_uav | 550 | 2.7 | %55 | %45 | 143sn | x0.35 | %0 | kısmen |
| mortar_team | 180 | 13.7 | %24 | %76 | 179sn | x0.39 | %8 | ✔ |
| mbt | 500 | 5.1 | %14 | %86 | 131sn | x0.39 | %0 | ✔ |
| commando | 320 | — | %8 | %92 | 165sn | x0.60 | — | ✗ |
| **spaag** | 300 | 22.2 | %56 | %44 | 220sn | **x1.13** | %33 | ✗ |
| **tank_destroyer** | 420 | 5.8 | %28 | %72 | 185sn | **x1.45** | %0 | ✔ |
| **at_team** | 170 | 3 | %12 | %88 | 146sn | **x1.55** | %22 | ✗ |

*(infantry/commando "ATIŞ —": mühimmatları sınırsız, atış sayacı mühimmat düşüşünden okunuyor.)*

## Silahsız birimler (ömürle değerlendirilir)

| birim | ₺ | ömür | not | bakıldı mı |
|---|---|---|---|---|
| **transport_helo** | 400 | **111sn** | erken ölüyor; hiç taşıma yapıyor mu ölçülmedi | ✗ |
| **command_vehicle** | 600 | **123sn** | geri bölge birimi için kısa ömür | ✗ |
| medic | 160 | 203sn | — | ✗ |
| recon_uav | 150 | 174sn | — | kısmen |
| ew_vehicle | 480 | 229sn | jam mekaniği düzeltildi, konumlandırma elendi | ✔ |
| drone_operator | 240 | 228sn | — | kısmen |
| supply_truck | 250 | 238sn | refakat elendi (mühimmat bağlayıcı kısıt değil) | ✔ |
| counter_battery_radar | 350 | 365sn | hiç ölmüyor; işe yarıyor mu ölçülmedi | ✗ |

## Öncelik sırası — boşa giden para (maliyet × (1 − getiri))

| # | birim | boşa giden | asıl sorun |
|---|---|---|---|
| 1 | **ballistic_missile** | ~1050₺ | %100 hedefi var, 1 atış yapıyor, **hiçbir şey öldürmüyor** |
| 2 | **sam_battery** | ~670₺ | %95 boşta, 0.7 atış, **%67 tam yükle ölüyor** |
| 3 | **mlrs** | ~550₺ | %58 hedefi var ama 2.8 atış — 321sn yaşayıp az iş yapıyor |
| 4 | **attack_helo** | ~575₺ | %79 hedefi var, 5.5 atış, ama **82sn'de ölüyor** |
| 5 | **command_vehicle** | ~600₺ | 123sn'de ölüyor (geri bölge birimi) |
| 6 | **artillery** | ~400₺ | 92sn'de ölüyor |
| 7 | **transport_helo** | ~400₺ | 111sn'de ölüyor; taşıma yapıyor mu bilinmiyor |
| 8 | **ifv** | ~290₺ | **57sn — en kısa ömür**, %70 tam yükle ölüyor |
| 9 | **engineer / scout_vehicle** | ~380₺ | ikisi de x0; scout %45 tam yükle ölüyor |

## Çıkarımlar

**İyi çalışan üçlü:** `at_team` (x1.55), `tank_destroyer` (x1.45), `spaag` (x1.13) — üçü de
ucuz-orta maliyetli, uzun yaşayan, karşı-birim uzmanı. **Üçü de hiç incelenmemişti.**

**En pahalı üç birim en kötü getiriye sahip:** ballistic (1050₺ → x0), attack_helo (800₺ → x0.28),
sam_battery (700₺ → x0.04). Bütçenin büyük kalemleri para kaybettiriyor.

**"Tam yükle ölmek" yeni bir kırmızı bayrak:** sam_battery %67, ifv %70, scout_vehicle %45.
Bu birimler mühimmatlarını kullanmadan ölüyor — ya menzile giremiyorlar ya da yanlış yerdeler.

**`hedefli` sütunu iki ayrı hastalığı ayırıyor:**
- *Hedefi var ama iş çıkmıyor* (ballistic %100, mlrs %58, artillery %51) → atış/etki sorunu
- *Hedefi hiç yok* (sam %5, ifv %7, scout %2, engineer %2, mbt %14) → konum/menzil sorunu

---

# BİRİM #1 — BALİSTİK FÜZE (1050₺, getiri x0) · ELE ALINDI

## Teşhis: sorun mesafe değil GÖRÜŞ — ve önceki hükmüm yanlıştı

| ölçüm (6 tohum, normal ordu) | değer |
|---|---|
| hedef geometrik olarak menzilde | **%100** |
| hedef **görünür** | **%0-3** |
| hiç ateş etmeyen tohum | **4/6** |
| ateş edenlerde ilk atış | 156sn / 192sn |

**Dün "gözcü sorunu değil (%9.4)" demiştim — o ölçüm `KESIF-balistik-1` tarifiyle, yani
keşif-AĞIRLIKLI bir orduyla yapılmıştı.** Ölçüm kurgusu bulguyu tersine çevirmiş. Normal orduda
balistik hedefini göremiyor.

**Doğrudan kanıt** (orduya 2 keşif İHA + 2 keşif aracı zorunlu kılınca):

| | keşif YOK | keşif VAR |
|---|---|---|
| hiç ateş etmeyen | 4/6 | **1/6** |
| ilk atış | 156-192sn | **11-20sn** |

## Kural: `spotterRequirement` — "gözcüsüz keskin nişancı alınmaz"

`js/BattleDeployment.js` `battleGozcuKuraliUygula` — menzili kendi görüşünün `PRO_SPOTTER_KAT`(3)
katından fazla olan silahlı birim varsa, orduda en az `PRO_SPOTTER_MIN`(3) keşif bulunur; yoksa
**en ucuz** gözcü satın alınır (mızrak bütçesini az bozsun). Para yetmezse vazgeçilir.
**Her iki kurucu yola da uygulanır** — tarif modu sezgisel zinciri tamamen atlıyor (ilk sürümde
yalnız sezgisel yola koymuştum ve kural hiç bağlamadı).

## Sonuçlar

| | kural KAPALI | kural AÇIK |
|---|---|---|
| hiç ateş etmeyen | **4/6** | **0/6** |
| ilk atış | 156sn / 192sn | **10-13sn** |
| toplam atış (6 tohum) | 2 | **6** |
| **verdiği hasar** | 516 | **2243** |
| öldürdüğü birim | 2 | 0 |

**Hasar 4.3× arttı.** Öldürme sayısı gürültülü — 600 hasarlık patlama çok birime dağılıyor,
öldürücü darbe başkasına yazılıyor; bu yüzden ekonomik ölçü olarak HASAR alındı.

**Maç kapısı: FARK YOK** — ve sebebi öğretici. Test ettiğim gerçekçi kompozisyon (`ORN-244`)
zaten keşif içeriyor (İHA %3.5 + keşif aracı %5.1 → 3+ birim), yani kural bağlamıyor ve iki kol
birebir aynı çıkıyor.

**Dolayısıyla bu bir GÜVENLİK AĞI:** normal orduları değiştirmez, keşif-fakiri orduların 1050₺'lik
balistiği çöpe atmasını engeller. Turnuva keşifsiz kompozisyonları da denediği için orada değer
üretir. Varsayılan AÇIK; maliyeti bağlamadığında sıfır.

**Kapılar:** forktest `true` · liverepro `false`.

---

# BİRİM #2 — SAM BATARYASI (700₺, getiri x0.04) · ELE ALINDI

## Teşhis: 12 birim, 6 tohum, **TOPLAM 0 ATIŞ**

| ölçüm (kural kapalı) | değer |
|---|---|
| düşmanda uçak bulunan süre | **%100** |
| uçak **menzilde** olan süre | %21 |
| uçak menzilde **ve GÖRÜNÜR** | **%0** |
| uçak kendi görüşünde (900px) | **%0** |
| **toplam atış** | **0** |
| ölen / tam yükle ölen | 8/12 · **8/8** |
| ortalama derinlik | **0.67** (düşman yarısı) |
| SAM'i öldürenler | tank_destroyer 4, ifv 3, artillery 1 — **hepsi KARA** |

Düşman uçakları hep **900px ile 1650px arasında**: menzilde ama görüşün ötesinde ve hiçbir dost
onları görmüyor. SAM menzilinin **%45'ini kullanamıyor** ve mühimmatını hiç harcamadan ölüyor.

**Kök neden balistikle aynı aileden ama kanal farklı:** hava hedefini normal keşif AÇMAZ —
`canSee(…, isAir=true)` yalnız **`airRadar`** taşıyan birimi dinler ve rosterde bu bayrağı taşıyan
tek birim `counter_battery_radar`'dır (350₺).

*(Yan bulgu: SAM'in `radar_silent` yeteneği UnitData'da ilan edilmiş ama kodda **hiç uygulanmamış** —
jamming etkileri gibi bir ölü yetenek daha.)*

## Kural genişletildi: `spotterRequirement` artık İKİ gözcü sınıfı tanıyor

| hedef | gözcü | eşik | asgari |
|---|---|---|---|
| KARA (balistik vb.) | keşif aracı / keşif İHA | menzil > görüş × **3** | 3 |
| **HAVA (SAM vb.)** | **hava-arama radarı** | menzil > görüş × **1.5** | **1** |

SAM oranı 1650/900 = **1.83** — kara eşiği (3) onu yakalamıyordu, bu yüzden hava tarafı ayrı ve
düşük eşikle tanımlandı.

## Sonuçlar (izole A/B, 6 tohum, 12 SAM)

| | kural KAPALI | kural AÇIK |
|---|---|---|
| **toplam atış** | **0** | **8** |
| tam yükle ölen | 8 | **4** |
| **düşmanda uçak bulunan süre** | %100 | **%58** |
| menzilde görünür | %0 | %1 |

Son satır en anlamlısı: SAM ateş edebildiğinde **düşmanın uçakları düşüyor** — uçak bulundurma
süresi %100'den %58'e iniyor. Birim işini yapmaya başlıyor.

**Kalan sorun (ayrı iş):** SAM ortalama **0.67 derinlikte**, yani düşman yarısında duruyor ve
kara birimlerine yem oluyor (11/12 ölüyor). Hava savunması geri bölgede olmalı — bu bir
konumlandırma becerisi ve sıraya alındı.

**Kapılar:** forktest `true` · liverepro `false` · pdtest OK.

---

# ⚠ DÜZELTME — #1, #2 ve #3'ün SAYILARI GEÇERSİZ (ölçüm kurgusu hatası)

**Hata:** Bu üç birimi `zorunlu`-only tarifle ölçtüm (`{ zorunlu: { mlrs: 2 } }` gibi, `paylar`/
`tipPaylari` YOK). Böyle bir tarif orduyu **doldurmuyor**: 6500₺ ile yalnızca **5 birim** kuruluyor
(2 sınanan + gözcü kuralının aldığı 3 keşif) ve bütçenin çoğu harcanmadan kalıyor. Neredeyse boş bir
orduda ölçüm yaptım; her birim doğal olarak bozuk göründü.

*(Aynı hatanın kardeşini bir gün önce yapmıştım: 26 birimi 6500₺'ye zorlamak. Kurgu, ölçümün kendisi
kadar ölçülmeli.)*

**Düzeltme:** `qa-runtime/gercekci-taban.json` (ORN-244 payları) tüm teşhis araçlarına taban olarak
eklendi. Yeniden ölçüm:

| birim | ₺ | getiri (BOZUK) | **getiri (DOĞRU)** | değişim |
|---|---|---|---|---|
| sam_battery | 700 | x0.04 | **x0.55** | 13× |
| attack_helo | 800 | x0.28 | **x0.88** | 3× |
| ballistic_missile | 1050 | x0 | **x0.15** | — |
| mlrs | 650 | x0.15 | x0.09 | — |
| ifv | 320 | x0.10 | **x0.05** | daha kötü |

**Geçersiz olan iddialar (geri çekiliyor):**
- ~~"SAM 12 birim 6 tohum TOPLAM 0 ATIŞ"~~ → gerçekçi orduda **39 atış**, ölen 8→3, tam-yükle 8→1
- ~~"Balistik 4/6 tohumda hiç ateş etmiyor"~~ → gerçekçi orduda **0/6**, 16 imha
- ~~"ÇNRA hasar/₺ 0.51, gözcü kuralı 6.8× kazandırıyor"~~ → gerçekçi orduda **hasar/₺ 1.07** ve
  gözcü kuralının etkisi **SIFIR**

**`spotterRequirement` kuralı hakkında dürüst durum:** gerçekçi ordularda **hiçbir etkisi yok**
(üç birimde de iki kol birebir aynı) — çünkü gerçek kompozisyonlar zaten keşif ve radar içeriyor.
Kural yalnız keşif/radar-fakiri ordularda bağlar. Varsayılan AÇIK kalıyor çünkü bağlamadığında
maliyeti sıfır ve turnuva bu tür kompozisyonları da deniyor — ama onu "büyük kazanç" olarak
sunmam yanlıştı.

## Düzeltilmiş öncelik listesi (gerçekçi ordu)

| # | birim | ₺ | getiri | asıl sorun |
|---|---|---|---|---|
| 1 | **mlrs** | 650 | **x0.09** | %82 hedefli ve ateş ediyor ama **%85 KURU**, hiç ikmal almıyor, ikmal halesinde %0 |
| 2 | **ifv** | 320 | **x0.05** | **66sn — en kısa ömür**, %88 boşta |
| 3 | **ballistic_missile** | 1050 | x0.15 | tek atış; pahalı ve etkisi sınırlı |
| 4 | **mbt** | 500 | x0.26 | %55 boşta |
| 5 | **transport_helo** | 400 | — | **80sn'de ölüyor** |
| 6 | **command_vehicle** | 600 | — | 166sn |

**Sağlıklı çıkanlar:** tank_destroyer x1.35 · at_team x1.18 · attack_helo x0.88 ·
sam_battery x0.55 · armed_uav x0.55

---

# BİRİM #3 — ÇNRA (650₺, getiri x0.09) · ELE ALINDI · **EN BÜYÜK KAZANÇ**

## Teşhis (gerçekçi ordu)

ÇNRA aslında iyi nişan alıyor: **%82 hedefli**, 36 atış, 0 ölüm, hasar/₺ 1.07.
Tek sorunu **mühimmat**: şarjörü 3, ilk 60-85sn'de bitiyor ve ömrünün **%85'ini KURU** geçiriyor.
İkmal aldığı: **0**. Sebep tek satırda: **orduda hiç ikmal aracı yok** (22 birim, 0 araç).

Bu yüzden daha önce elenen `supplyEscort` (araç topçuya gelsin) burada da bağlamıyordu —
taşıyacak araç yoktu (bind 0).

## İki kompozisyon kuralı + bir bütçe düzeltmesi

**`logisticsRequirement`** (gözcü kuralının kardeşi): şarjörü ≤4 ve maliyeti ≥300₺ olan silahlı
birim varsa, orduda en az 1 ikmal kaynağı bulunur.

**`battleDestekIcinYerAc`** — kritik ara adım. Tarif çözücüsü bütçenin **%99'unu** harcıyor
(6410/6500, kalan 90₺); iki kural da "en ucuzunu al" derken parayı **bulamıyordu** ve sessizce
bağlamıyordu. Mevcut `atCap` kuralının tersi: gerekirse en ucuz muharibi satıp zorunlu destek
birimine yer açar. *(Satış tavanı 2 iken 240₺'de takılıyordu; 3 yapıldı.)*

## Sonuçlar

| | kural KAPALI | kural AÇIK |
|---|---|---|
| ikmal aracı | 0 | **1** |
| keşif | 2 | **3** |
| ikmal halesinde geçen süre | %0 | **%69** |
| **ÇNRA toplam hasarı** | 9655 | **11872** |
| hasar/₺ | 1.24 | **1.52** |

### MAÇ KAPISI — oturumun en büyük etkisi, İKİ HAVUZDA DA

| havuz | kural KAPALI | kural AÇIK |
|---|---|---|
| dışörneklem (48) | 16/48 · −1265 ±629 | **39/48 · +1816 ±605** |
| **FİNAL (48, ayrılmış)** | 16/48 · −1040 ±603 | **37/48 · +1717 ±630** |

Marj farkı **~2800-3100**, hata payının 3+ katı (z≈3.2-3.5) ve **ayrılmış havuzda tekrarlandı**.
Kompozisyon kuralları kaybeden orduyu kazanan orduya çeviriyor.

**Dürüst çekinceler:**
- Bu bir **DEMET** sonucu: `spotterRequirement` + `logisticsRequirement` birlikte açıldı,
  hangisinin ne kadar taşıdığı ayrıştırılmadı.
- Kompozisyon ÇNRA-zorunlu; her orduya genellenemez. Ama kurallar yalnız ihtiyaç olduğunda
  bağladığı için genel orduda maliyeti sıfır.

**Kapılar:** forktest `true` · liverepro `false`.

## Dersin özeti — "birim bozuk" değil, "ordu eksik"

Üç birimin üçünde de sorun birimin kendi davranışı değil **ordunun kompozisyonu** çıktı:
balistik/ÇNRA gözcüsüz, SAM radarsız, ÇNRA ikmalsiz. Birim-içi beceriler (7 tanesi) üst üste
elenirken, iki kompozisyon kuralı tek başına maçı çevirdi.

---

# BİRİM #4 — IFV / ZMA (320₺, getiri x0.05, ömür 57-66sn) · ELE ALINDI
## Bulgu: **metrik yanlıştı, birim değil**

## Teşhis

IFV, UnitData'da 4 kişilik taşıma kapasitesine sahip (`transport: { slots: 4, allows: ["infantry"] }`)
ve `load`/`unload` yetenekleri tanımlı. Ama `js/Unit.js:95`:

```js
this.transportSlots = (s.transport && s.transport.slots && this.isAir) ? s.transport.slots : 0;
```

**`&& this.isAir`** → taşıma yalnız HAVA birimlerine veriliyor. IFV'nin taşıma kapasitesi kasıtlı
olarak devre dışı (kod yorumu: *"ZMA taşıma-verisi var ama savaşçı olduğu için oto-taşımaz"*).
Yani 320₺'lik taşıyıcı hiç taşımıyor; 375px'lik topuyla zayıf bir tank gibi kullanılıyor.

## Kompozisyon testi — sezgimi ÇÜRÜTTÜ (iki havuzda da)

| IFV payı | dışörneklem | FİNAL (ayrılmış) |
|---|---|---|
| **taban %7.4** | **35/48 · +1140 ±645** | **34/48 · +1061 ±649** |
| sıfır (%0) | 34/48 · +670 ±594 | 29/48 · +411 ±686 |
| çift (%14.8) | 23/48 · −572 ±732 | 21/48 · −538 ±682 |

IFV'yi **çıkarmak da, iki katına çıkarmak da kötü.** Mevcut pay doğru.

## Asıl ders: `getiri` metriği PERDE birimlerini yanlış değerlendiriyor

IFV'nin getirisi x0.05 (imha/maliyet) — rosterin en kötülerinden. Ama onu ordudan çıkarmak
maçı kötüleştiriyor. Çünkü rol etiketleri **`screen, flanker`**: işi öldürmek değil **hasar emmek**.

Sağlık kontrolüne yeni sütun eklendi: **EMİLEN** = üstüne çektiği hasar ÷ maliyeti.

| birim | getiri | **EMİLEN** | okuma |
|---|---|---|---|
| infantry | x0.31 | **2.01** | ucuz perde — asıl işi bu |
| spaag | x1.13 | 1.25 | hem vuruyor hem emiyor |
| engineer | x0 | **1.19** | "x0 getiri" yanıltıcıydı |
| mbt | x0.39 | 1.07 | mızrak + emici |
| **ifv** | **x0.05** | **1.01** | **kendi parası kadar hasar emiyor** |
| supply_truck | — | 0.92 | (istenmeyen: ikmal aracı ateş çekiyor) |
| tank_destroyer | x1.45 | 0.43 | saf katil — emmiyor |
| counter_battery_radar | — | **0.02** | tam güvende, doğru konumlanmış |

**Kural:** bir birimi "kötü" ilan etmeden önce `getiri + EMİLEN` birlikte okunur. Yalnız getiriye
bakmak `infantry`, `engineer`, `ifv` gibi perde birimlerini haksız yere mahkûm eder.

**Durum:** IFV'ye müdahale YOK — mevcut payı optimal. Taşıma yeteneğini açmak ayrı ve büyük bir iş
(yükle-taşı-indir davranışı + AI kararı); sıraya alındı, bu oturumda yapılmadı.

---

# INTEL4-PRO vs INTEL4 — bugünkü işten sonra nerede duruyoruz

Kullanıcı sorusu: *"intel4 pro vs intel4 değişmiş olmalı bu becerilerle."*
Aynı kompozisyon, tek fark gövde. Dört hücre, iki havuz.

| saldıran | savunan | dışörneklem | FİNAL |
|---|---|---|---|
| INTEL4 | INTEL4 | 39/48 · +1731 | 33/48 · +1162 |
| INTEL4 | **PRO** | 21/48 · **−471** | 31/48 · +630 |
| **PRO** | INTEL4 | 31/48 · +789 | 36/48 · +1188 |
| PRO | PRO | 26/48 · +78 | 26/48 · +281 |

**Özet (96 tohum, iki havuz birleşik):**

| rol | saldıranın gördüğü ortalama marj |
|---|---|
| savunan **INTEL4** | **+1217** |
| savunan **PRO** | **+130** |

→ **Savunma tarafında pro ~1090 marj daha iyi.** Saldıran tarafında ~179 daha kötü (gürültü içinde).

**Bütün oturum boyunca kovaladığımız "savunan kaybediyor" sorunu büyük ölçüde kapanmış** —
ama bu bugünkü becerilerden DEĞİL.

## Atıf: bugünkü beceriler bu kazancı vermedi

`standoff` + `heloHunt` savunanda açık/kapalı: **birebir aynı sonuç** (21/48, −471).
Sebep basit: bu kompozisyonda bağlamıyorlar — `standoff` ≥600px ölü bölge ister (ÇNRA/balistik),
`heloHunt` taarruz helosu ister. Savunanın ordusunda ikisi de yok.

Pro'nun savunma üstünlüğü **önceden var olan** deltalardan geliyor (assaultCohesion, counterBattery,
indirectMassing, trueForceRatio) ve muhtemelen bugünkü **global** mekanik düzeltmelerinden
(boş namlu, kısmi jam) — ikisi de her iki tarafa uygulanıyor.

## Bugünkü işin gerçekte ödediği yer

Kompozisyon kuralları, **ihtiyaç duyan** bir orduda ölçüldüğünde (ÇNRA-zorunlu):

| havuz | kurallar KAPALI | kurallar AÇIK |
|---|---|---|
| dışörneklem | 16/48 · −1265 | **39/48 · +1816** |
| FİNAL | 16/48 · −1040 | **37/48 · +1717** |

**Yani beceriler KOŞULLU:** ilgili birim orduda varsa çok değerli, yoksa sıfır. Bu bir kusur değil —
kural yalnız eksik olanı tamamlıyor.

## Yol boyunca bulunan yapısal kısıt (düzeltildi)

Kompozisyon katmanı **yalnız saldırana (kırmızı)** uygulanıyordu: tezgâh savunanın ordusunu
`pro:false` (sezgisel) veya `pro` alanı hiç verilmeden (tarif) kuruyordu; oyunun kendi yolunda da
`pro: BATTLE_INTEL4PRO_RED`. Savunan yapısal olarak dışarıdaydı. Tezgâhta düzeltildi
(`pro: BATTLE_INTEL4PRO_BLUE === true`). ORN-244 savunanında etkisi yok — o orduda ÇNRA/SAM
bulunmuyor, yani kuralın tamamlayacağı eksik yok — ama ÇNRA/SAM taşıyan savunanlarda bağlayacak.

---

# PLAN (kullanıcı, turnuva sonrası sıralama)

1. **Beceri ağacını bitir** — 25 birimin *hepsi* en az bir kez incelenmiş olacak.
2. **Turnuvanın çıkardığı kompozisyonu deterministik testlerden geçir**, birim türü yüzdelerine
   göre yeniden dağıt (→ AI'ın varsayılan doktrini).
3. **Gece koşusu beonai için** — durum-değer ağı verisi + eğitim.

## 1. maddenin durumu: hangi birim incelendi

**İncelenmiş (teşhis + müdahale ya da gerekçeli hüküm):**

| birim | sonuç |
|---|---|
| ballistic_missile | `spotterRequirement` — gözcüsüz kullanılamaz |
| sam_battery | hava radarı şartı — `airRadar` olmadan menzilinin %45'i ölü |
| mlrs | `logisticsRequirement` — **oturumun en büyük kazancı** (16/48 → 37/48) |
| ifv | müdahale yok; **metrik yanlıştı** → `EMİLEN` sütunu eklendi |
| attack_helo | `heloHunt` — atış ~5×, K1-K4 geçti |
| mortar / artillery | `standoff` geçti; `indirectCreep` elendi |
| ew_vehicle | 3 ölü katman düzeltildi (kısmi jam, keşif jamı, görüş kesme) |
| supply_truck | `supplyEscort` elendi (o bağlamda mühimmat bağlayıcı değildi) |
| mbt / tank_destroyer | `armorFace` ve `localRatio` elendi — sorun yön değil YER |

**Hiç incelenmemiş (11 birim):**

| birim | ₺ | sağlık kontrolündeki işaret |
|---|---|---|
| transport_helo | 400 | **80sn'de ölüyor**; hiç taşıma yapıyor mu bilinmiyor |
| command_vehicle | 600 | 123-166sn'de ölüyor (geri bölge birimi) |
| counter_battery_radar | 350 | hiç ölmüyor (EMİLEN 0.02) — ama işe yarıyor mu? |
| commando | 320 | %92 boşta, getiri x0.60 |
| manpads_team | 190 | %94 boşta, %20 tam yükle ölüyor |
| engineer | 200 | getiri x0 ama **EMİLEN 1.19** → IFV vakası olabilir |
| scout_vehicle | 180 | getiri x0, **%45 tam yükle** ölüyor |
| infantry | 100 | **EMİLEN 2.01** (rosterin en yükseği) — muhtemelen sağlıklı |
| spaag | 300 | getiri **x1.13** + EMİLEN 1.25 → muhtemelen sağlıklı |
| at_team | 170 | getiri **x1.18** → muhtemelen sağlıklı |
| recon_uav / drone_operator | 150/240 | jam işinde kısmen bakıldı, kendi teşhisi yok |

**Triyaj:** yeşil olanlar (spaag, at_team, infantry) tek koşuluk doğrulamayla kapanır;
kırmızı bayraklılar (transport_helo, command_vehicle, scout_vehicle, manpads) derin teşhis ister.

## 2. maddenin yöntemi

Turnuva şampiyonunu doğrudan doktrin yapmak yerine **birim türü yüzdelerine ayrıştırıp**
yeniden dağıtmak doğru yaklaşım: tek bir tarif tek bir rakibe göre şekillenmiş olabilir
(taş-kağıt-makas bulgusu), ama *pay dağılımı* daha genellenebilir bir sinyal.
Deterministik testler: `--forktest`, `--liverepro` + kompozisyon A/B (iki havuz).

---

# TURNUVA SONUCU ve AŞIRI UYUM — şampiyon doktrin OLMADI

## Turnuva temiz bitti

```
TUR 1: 1399 → 34   1365'i GÜVEN kuralıyla (bütçe tavanı HİÇ kullanılmadı)
TUR 2:   34 →  9   panel (3 rakip)
TUR 3:    9 →  8
TUR 4:    8 →  1   ŞAMPİYON ORN-590  +2249 ±334  (122/144)
```

Tur 1'de kısa maç + tek rakip ekonomisi işe yaradı: 1365 aday **kanıtla** elendi.

## Şampiyonun kompozisyonu ve ilk 5'in ortak deseni

| kategori | günboyu taban (ORN-244) | ilk 5 ort. | fark |
|---|---|---|---|
| support | %7.7 | %15.3 | **+7.5** |
| air | %1.2 | %6.6 | **+5.4** |
| armor | %39.3 | %41.3 | +2.1 |
| infantry | %24.0 | %12.4 | **−11.5** |
| air_defense | %11.6 | %5.9 | −5.6 |

İlk 5 içindeki dağılım, hangi sinyalin sağlam olduğunu ayırdı: **dar** olanlar
air (%4.8-7.3), uav (%2.0-4.7), armor (%37.5-47.6); **geniş** olanlar infantry (%6.7-22.2),
air_defense (%3.1-11.5), indirect (%1.6-8.0) → son üçü 5 örnekte gürültü.

## ⚠ AŞIRI UYUM TESTİ — şampiyon panel dışında ÇÖKÜYOR

Aynı üç doktrin, üç farklı rakip kümesi:

| rakip kümesi | SAMPİYON | İLK5-ORT | TABAN-244 |
|---|---|---|---|
| dar panel (3 — turnuvanın seçtiği) | **+2249** | +1378 | +770 |
| **geniş panel (12 çeşitli)** | **+2330** | **+2268** | **+2277** |
| **güçlü panel dışı (2)** | **−1679** | −673 | −914 |

**Üç ayrı sonuç, üç ayrı ders:**

1. **Dar panelde şampiyon çok önde görünüyor** — ama tam da o üç rakibe karşı SEÇİLDİ.
   Bu, seçim artefaktı.
2. **Geniş panelde (12 çeşitli rakip) üçü de EŞİT** (+2330 / +2277 / +2268, 246-251/288).
   Yani 33.576 maçlık tur 1, günboyu kullandığım tabandan **daha iyi bir şey bulamadı.**
3. **Güçlü panel dışı rakiplere karşı üçü de kaybediyor** — ve en çok şampiyon kaybediyor.
   `ORN-1287` savunan olarak üç doktrini de eziyor (−1475, −2957, −2762).

## Metodolojik ders: panel ÇEŞİTLİ ama GÜÇLÜ olmalı

Geniş paneli "kompozisyon uzayında en yayılmış" diye seçtim (greedy max-min). Sonuç: panel
**çeşitli ama zayıf** çıktı — herkes %86 kazanıyor, dolayısıyla ayırt etmiyor. Ayırt eden şey
zayıf-çeşitli rakipler değil, **güçlü sayaçlar**.

> **Kural:** rakip paneli iki eksende birden seçilmeli — kompozisyon çeşitliliği VE ölçülmüş güç.
> Yalnız çeşitlilik kolay panel, yalnız güç dar panel üretir.

## Planın 2. maddesi için sonuç: tek doktrin BENİMSENMEDİ

Şampiyonu doktrin yapmak yanlış olurdu. Uzay geçişsiz (taş-kağıt-makas): "en iyi kompozisyon"
yok, "şuna karşı en iyi" var. Doğru yön **uyarlanabilir kompozisyon** — keşfedilen düşmana göre
ordu kurmak. Altyapı kısmen mevcut (tehdit-profili / rakip-inanç).

**Kaydedilen tek sağlam sinyal:** ilk 5'in hepsi zırh ağırlıklı (%37-48) ve hepsinde hava var
(%4.8-7.3) — bu iki eksen 5 adayın hepsinde tutarlı. Taban zaten zırh %39; hava payı ise
%1.2 → %6.6, tek gerçek fark burada olabilir. Ayrıca sınanmalı.
