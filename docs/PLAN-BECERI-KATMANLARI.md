# ÇOK KATMANLI BECERİ GELİŞTİRME PLANI

**Tarih:** 2026-08-05
**Kaynak fikir (kullanıcı):** "bu işin sırrı en iyi kombinasyonu seçmekten ziyade helikopteri veya
balistiği en iyi kullanan AI eğitmek" + "her birlik için onlarca yetenek, hepsini tek tek test ederek
ilerlersin, sonra eğitim için GPU'yu daha fazla kullanırız"

---

## 0. NEDEN BU YÖN — kompozisyon değil beceri

Koşan sürüm turnuvası (255 aday) **"bu AI'ın kullanabildiği kompozisyonlar hangileri?"** sorusunu
yanıtlıyor; "hangi kompozisyon iyi?" sorusunu değil. Fark kritik:

Balistik füze, turnuvada sonuncu sıralara düşer. Ama ölçtük ki **hiç ateş etmiyor** (0 atış, 125sn'de
ölüyor). Yani turnuva "balistik kötü" der; gerçek ise "AI balistiği kullanamıyor". Kompozisyonu AI'ın
zaaflarına göre optimize etmek o zaafları **kalıcılaştırır**.

Aynı şey öğrenen tarafta da geçerli: beonai (ve daha önce denenen 100 bin+ parametreli ağ) yalnızca
*bizim yazdığımız gramerin* ürettiği adayları sıralayabilir. "Balistiği standoff mesafesinde tut"
gramerde ifade edilemiyorsa hiçbir parametre sayısı onu bulamaz. **Parametre sayısı hiçbir zaman
darboğaz değildi** — ifade uzayı, öğretmen kalitesi ve ölçüm gürültüsü darboğazdı.

---

## 1. TEMEL KALDIRAÇ: mekanizma metrikleri gürültüsüz

Bugünün en pahalı dersi ölçüm gürültüsüydü: maç marjının std'si 3114, bir A/B kararı için 37+ tohum.
**Beceri metrikleri bu gürültüye tabi değil:**

| soru | metrik | gerekli tohum | süre |
|---|---|---|---|
| "bu kompozisyon iyi mi?" | maç marjı | 37+ | ~40 sn |
| "balistik ateş etti mi?" | atış sayısı | **1** | **~2 sn** |
| "birim ölü bölgede kaldı mı?" | ölü-bölge tik sayısı | **1** | ~2 sn |
| "ÇNRA'nın ömrü uzadı mı?" | ölüm saniyesi | 3-6 | ~10 sn |

Bu, beceri döngüsünü kompozisyon döngüsünden **~20× ucuz** yapar. Plan bunun üzerine kuruludur.

### 1b. ÇOKLU KARŞILAŞTIRMA TUZAĞI (planın en önemli kısıtı)

250 beceriyi tek tek %95 güvenle maç-A/B'sine sokarsak, **saf şansla ~12 tanesi "kazandı" çıkar.**
Ölçüm krizinde yaşadığımız şeyin ölçekli hâli budur. Bu yüzden:

> **Maç kapısı bireysel becerilere UYGULANMAZ.** Eleme mekanizma katmanlarında yapılır
> (bunlar neredeyse deterministtir, çoklu-karşılaştırma sorunu yoktur); maç kapısı yalnız
> **demetlere** (5-10 beceri birlikte) ve ayrılmış tohum havuzuna uygulanır.

---

## 2. KATMANLAR

Her beceri şu sırayla ilerler; bir katmanı geçemeyen üst katmana çıkmaz.

### Katman 0 — Kayıt defteri
Her beceri makine-okunur bir kayıt: `{ ad, hedef birim sınıfı, tetik koşulu, parametreler[],
mekanizma metriği, geçme eşiği, bağlı olduğu delta anahtarı }`. Testler bu kayıttan otomatik üretilir;
elle test yazımı ölçeklenmez.

### Katman 1 — MEKANİZMA KAPISI  · 1-3 tohum · ~5 sn
İki soru: **(a)** kural bağlıyor mu (bind sayacı > 0)? **(b)** hedef metrik amaçlanan yöne gitti mi?
İzole A/B şart: her iki kolda diğer tüm deltalar AYNI, yalnız sınanan anahtar değişir.
*Kötü fikirlerin ~%80'i burada ölür ve maliyeti saniyelerdir.*

### Katman 2 — BİRİM EKONOMİSİ  · 12 tohum · ~20 sn
"Kural çalışıyor ama birim işe yaramaz hâle geldi" tuzağını yakalar.
Metrikler: verilen hasar ÷ maliyet, ömür (sn), mühimmat verimi (hasar ÷ mermi).

### Katman 3 — YAN ETKİ TARAMASI  · 12 tohum · ~20 sn
Kural hedeflenen sınıfın dışına taşıyor mu? (Örn. standoff, havan/obüs'ü savaştan koparıyor mu?)
Aynı ailenin diğer birimlerinin mekanizma metrikleri kontrol edilir.

### Katman 4 — MAÇ KAPISI  · 37+ tohum · ~3 dk · **YALNIZ DEMETLERE**
Katman 1-3'ü geçen beceriler 5-10'luk demetler hâlinde marj/kazanma oranına vurulur.
Demet kazanırsa **geri-çıkarma** (ablation) ile hangi üyenin taşıdığı aranır — ama bu da demet içi,
sınırlı sayıda karşılaştırmadır.

### Katman 5 — PARAMETRE ARAMASI (GPU)
Hayatta kalan her becerinin 3-5 sayısal parametresi var (eşik, oran, mesafe, süre).
30-40 beceri × ~4 parametre = **~150 boyutlu sürekli arama uzayı.**
Burada elle ayar biter, arama başlar: self-play + CMA-ES / rastgele arama, GPU'da toplu değerlendirme.

> **Burada "kendi kodunu yazan AI" tartışması somutlaşır.** Beceri *iskeletini* biz yazıyoruz;
> ama 150 boyutlu parametre vektörü davranışı belirler ve onu arama bulur. Bir sonraki adım
> iskeletin kendisini aramaya açmak (koşul ağaçlarının program-sentezi) — o, Katman 5 sağlam
> çalıştıktan sonra anlamlı.

---

## 3. BECERİ KATALOĞU

**Dürüst sayım:** birim başına "onlarca" beceri gerçekçi değil — anlamlı, ayırt edilebilir beceri
sayısı aile başına 3-6'dır, toplam ~35. Şişirilmiş bir katalog yalnız gürültü üretir.
**Asıl büyük sayı beceri değil parametre boyutudur (~150)** ve orası GPU'nun işidir.

Durum: ✅ mevcut · 🔨 yeni yazılacak · ⏸ ölçüldü, etkisiz

### Ateş desteği (havan · obüs · ÇNRA · balistik)
| # | beceri | durum | mekanizma metriği |
|---|---|---|---|
| 1 | **standoff** — ölü bölge yönetimi | ✅ **BUGÜN YAPILDI** | atış sayısı 0→1, ölü-bölge tik 0 |
| 2 | gözcü bağı — kendi görüşü ötesine ateş | 🔨 | görüş-ötesi atış sayısı |
| 3 | shoot-and-scoot — ateş sonrası mevzi değiştir | 🔨 | karşı-batarya ile ölüm oranı |
| 4 | açılış mevzii — menzil bandının merkezine konuşlan | 🔨 | ilk atış saniyesi |
| 5 | ikmal bağı — mühimmat bitince ikmale git | 🔨 | kuru geçen tik sayısı |
| 6 | karşı-batarya önceliği | ✅ counterBattery | düşman dolaylı birim ölümü |
| 7 | kütle hedefleme | ✅ indirectMassing | mermi başına isabet |
| 8 | mühimmat disiplini | ⏸ ammoDiscipline | (etkisiz ölçüldü) |

### Zırhlı (MBT · tanksavar · IFV)
| # | beceri | durum | mekanizma metriği |
|---|---|---|---|
| 9 | gövde-siperi (hull-down) | 🔨 | alınan hasar ÷ maruz kalınan atış |
| 10 | yan-zırh koruma (burnu düşmana dön) | 🔨 | yan isabet oranı |
| 11 | TD pusu disiplini | ✅ _canHoldFire | ilk atış mesafesi |
| 12 | IFV piyade indirme mesafesi | 🔨 | inen piyadenin ilk 10sn ölüm oranı |
| 13 | tank-piyade birlikte ilerleme | 🔨 | MBT'nin 300px'inde piyade tik oranı |

### Piyade (piyade · komando · AT timi · MANPADS)
| # | beceri | durum | mekanizma metriği |
|---|---|---|---|
| 14 | siperlenme öncelikli duruş | ✅ dig_in | ort. entrench |
| 15 | örtü kullanımı (açıkta koşma) | 🔨 | ormanda geçen tik oranı |
| 16 | AT timi vur-kaç | 🔨 | atış sonrası ömür |
| 17 | MANPADS EMCON (ateşle açığa çık) | 🔨 | ateş sonrası ölüm gecikmesi |
| 18 | komando sızma rotası | 🔨 | düşman derinliğine ulaşma oranı |

### Hava (taarruz helo · SİHA · nakliye helo · kamikaze dron)
| # | beceri | durum | mekanizma metriği |
|---|---|---|---|
| 19 | SEAD-bekle | ✅ | AA canlıyken öne çıkma tiki |
| 20 | helo standoff — ATGM menzilinden vur | 🔨 | ateş mesafesi ort. |
| 21 | pop-up saldırı | 🔨 | maruz kalma süresi |
| 22 | yakıt/üs döngüsü | ✅ updateFuel | yakıtsız düşme sayısı |
| 23 | nakliye iniş bölgesi güvenliği | 🔨 | inişte kaybedilen yolcu |

### Hava savunma (SAM · SPAAG · MANPADS)
| # | beceri | durum | mekanizma metriği |
|---|---|---|---|
| 24 | sabırlı-örümcek (havayı kovalama) | ✅ micro | kovalama tiki |
| 25 | radar EMCON (aç-kapa) | 🔨 | radar açıkken alınan hasar |
| 26 | katmanlı AA (SAM derin, SPAAG ön) | 🔨 | AA derinlik dağılımı |

### Destek (ikmal · istihkâm · sağlık · EH-jammer · radar · komuta)
| # | beceri | durum | mekanizma metriği |
|---|---|---|---|
| 27 | ikmal aracı güvenli mesafe | 🔨 | ikmal ölüm saniyesi |
| 28 | istihkâm siper zinciri | ✅ PRO_HOLD_ENGINEER_LINE | dikilen siper sayısı |
| 29 | jammer konumlandırma (dron koridoru) | 🔨 | jamlanan dron sayısı |
| 30 | karşı-batarya radarı yerleşimi | 🔨 | tespit edilen dolaylı birim |
| 31 | komuta aracı geride kalma | 🔨 | komuta ölüm saniyesi |

### Keşif (keşif aracı · keşif İHA · dron operatörü)
| # | beceri | durum | mekanizma metriği |
|---|---|---|---|
| 32 | ateş desteğine gözcü olarak bağlan | 🔨 (= #2'nin eşi) | sağlanan görüş-ötesi atış |
| 33 | keşif hattını ileride tut | 🔨 | keşif-ana kuvvet mesafesi |
| 34 | dron operatörü kontrol yarıçapı | 🔨 | kontrol-dışı kalan dron tiki |

**Toplam:** 34 beceri · 8 mevcut · 1 bugün eklendi · **25 yeni** · 1 etkisiz

---

## 4. SIRA (etki × maliyet)

> **DÜZELTME (ölçüm hipotezi çürüttü).** Bu listede #2 gözcü bağı ilk sıradaydı. `tools/gozcu-teshis.js`
> ölçtü: balistiğin ateş edemediği tiklerin yalnız **%9.4'ü** görüş kaynaklı; **%90.6'sında bantta
> GÖRÜNÜR hedefi vardı.** Gözcü darboğaz değil. Gerçek sebep bir AI becerisi bile değildi — mekanik
> hataydı (bkz. §7). #2 sırasını kaybetti; ölçülene kadar hiçbir beceri "önemli" ilan edilmeyecek.
> **Ders: her beceriden ÖNCE teşhis aracı yaz. Sıralama sezgiyle değil ölçümle kurulur.**

1. ~~**#5 ikmal bağı**~~ — **YAZILDI, KATMAN 2'DE ELENDİ** (bkz. §8). Kod duruyor, varsayılan kapalı.
3. **#9/#10 zırh mevzii** — MBT bütçenin en büyük kalemi; küçük oran iyileşmesi büyük ₺ değeri.
4. **#20 helo standoff** — kullanıcının özellikle işaret ettiği birim.
5. **#29 jammer konumlandırma** — turnuva turu 1'de ilk 5'te iki jammer adayı çıktı; birim değerli
   görünüyor, becerisi yok.
6. Kalanlar mekanizma kapısından geçtikçe.

---

## 5. ALTYAPI BORCU (planın çalışması için gereken)

- `tools/beceri-kapisi.js` — kayıt defterinden okuyup Katman 1-3'ü otomatik koşan tek araç.
  Şu an her beceri için elle teşhis aracı yazılıyor (balistik-teshis, dolayli-teshis); ölçeklenmez.
- `--withpro` / `--nostandoff` kalıbı **her** delta için genelleştirilmeli (izole A/B standardı).
- Determinizm kapısı her beceriden sonra: `--forktest --withpro` (katı fork eşitliği) + `--liverepro`.

---

## 6. BUGÜN TAMAMLANAN: #1 standoff

**Teşhis:** balistik füze 1050₺ (bütçenin %16'sı) ile alınıp **tek atış yapmadan** 125sn'de öldü.
minRange 1500px; düşman 40sn'de içeri girip bir daha çıkmıyor; AI'da `relocate` yeteneği var ama
kullanmıyor. Genel sorun değil — aynı maçta havan 14/26/25, topçu 23, ÇNRA 8 atış yaptı.

**Kural:** tehdit `minRange × 1.15` içine girerse tehdit kütlesinden uzaklaş, `minRange × 1.35`'e dön;
`menzil × 0.92`'yi aşma; tik başına en fazla 300px. Yalnız ölü bölgesi ≥600px olan birimler
(ÇNRA, balistik) — havan/obüs hariç, onlar zaten sorunsuz ateş ediyor.
`engageCombat`'tan SONRA çalışır → atışı kesmez, yalnız hareket hedefini ezer.

**İzole A/B (pro her iki kolda açık, yalnız `standoff` değişti), seed2024:**

| kol | atış | akıbet | t=40sn en yakın düşman |
|---|---|---|---|
| standoff kapalı | **0** | 141sn'de öldü | 1299px (ölü bölgede) |
| standoff açık | **1** | maçı sağ bitirdi | **2138px (atış bandında)** |

Kural 544 tik bağladı; `ölü-bölgedeyken: 0` → füze hiç ölü bölgeye düşmedi (önleyici çalıştı).

**Yan etki (izole, seed2024):** havan/obüs eşiğin altında olduğu için kurala hiç girmiyor;
ÇNRA atış sayısı aynı (3.85), ömrü 90→102sn uzadı. Hiçbir dolaylı birim susmadı.

**Determinizm:** `--forktest` (pro+standoff açık) `forkTutarli: true` · `--liverepro`
`divergenceVarMi: false`. (`--forktest --withai` sapması ÜÇ kolda da birebir aynı hash'i verdi —
sürücü yolunun önceden var olan özelliği, bu değişiklikle ilgisiz.)

**Henüz ölçülmedi:** maç sonucuna etkisi. Tek tohumda sonuç değişti ama buna iddia kurulmaz —
Katman 4 demet ölçümünü bekliyor.

**Parametreler (aranabilir):** `PRO_STANDOFF_MIN_PX=600` · `TRIP=1.15` · `HEDEF=1.35` ·
`TAVAN=0.92` · `ADIM=300`

---

## 7. AYNI GÜN BULUNAN MEKANİK HATA: birim boş namluyla sahaya çıkıyordu

#2'yi (gözcü bağı) yazmadan önce teşhis aracı koştum — ve beceri hiç gerekmedi.

**Ölçüm (`tools/gozcu-teshis.js`, balistik, seed2024):** ateş edemediği tiklerin dağılımı
(a) bantta hedef yok %0 · (b) bantta var görünmez **%9.4** · (c) bantta var **GÖRÜNÜR %90.6**.
İlk görünür hedef **6sn**'de; ilk atış **67sn**'de. Yani 61 saniye boyunca ateş edebilirdi.

**Kök neden — AI değil mekanik:** `rof 0.015 → atkSpeed 66.7sn` ve `lastAttackTime = 0` başlangıcı,
birimi maçın başında "daha doldurmadı" sayıyor. Birim sahaya **boş namluyla** çıkıyor.
`Unit.js`'teki `singleUse` istisnası aynı hatanın dron için zaten fark edilmiş dar bir yamasıydı.

| silah | kaybedilen ilk-atış süresi |
|---|---|
| taktik füze (balistik) | 66.7 sn |
| roket salvosu (ÇNRA) | 20.0 sn |
| yıkım şarjı (komando) | 12.5 sn |
| obüs | 5.6 sn |

**Düzeltme:** `BATTLE_SPAWN_LOADED` + `_hicAtesEtmedi` bayrağı (yapıcıda true, ilk atışta false).
`lastAttackTime`'ı negatif başlatmak yerine bayrak kullanıldı — öyle yapılsaydı `panicDecay`'in
"3sn'dir ateş etmedi" kontrolü de yan etkilenirdi.
Bayrak `battleSnapshotUnit` + `battleRestoreUnit` beyaz-listesine **eklenmek zorundaydı**; aksi hâlde
fork'tan dönen birim yapıcıdan `true` alıp bedava atış kazanır ve fork eşitliği bozulurdu.

**İzole A/B (seed2024):** ilk atış 67sn → **6sn**.
**Kapılar:** forktest `true` · liverepro `false` · defertest 201/201, ihlal 0.

**Bu bir denge değişikliğidir:** iki tarafa ve oyuncuya simetrik uygulanır, dolaylı ateşi güçlendirir.
Varsayılan açık — konuşlanan batarya namlusunda mermiyle gelir.

**Turnuva sonucu:** koşan sürüm turnuvası durduruldu ve yeniden başlatıldı. Mekanik koşulsuz ve
turnuva işçileri her parçada dosyaları yeniden yüklüyor → tur 3 kod değişikliğinin üstüne denk gelmişti,
aynı turdaki adaylar farklı kurallarla ölçülüyordu. Zaten yeniden koşulmalıydı: **balistik ve ÇNRA
adayları bozuk bir mekanik altında elenmişti.** Tur 1-2 sonuçları (tutarlı kod) kayıt için geçerli:
tur 1 lider `KESIF2-jammer+sam` +2385±1074 · tur 2 lider `KESIF-jammer-1` +2534±721 (15/16).

---

## 8. #5 İKMAL BAĞI — kapı sistemi ilk kez bir beceriyi ELEDİ

Bu bölüm bir başarısızlığın kaydı ve tam da bu yüzden değerli: **kapı sistemi çalıştı.**

**Katman 1 — teşhis (`tools/muhimmat-teshis.js`, pro KAPALI, seed2024):**
8 tanksavar timi ömrünün **%71-77'sini KURU** geçiriyor (84sn'de kuruyup maç sonuna kadar boş
şarjörle geziyorlar). Toplam kuru-tik oranı %19.2. Kuruyken en yakın ikmal aracı **1100-1600px**
uzakta, kamyon halesi ise yalnız 400px → ikmal **pasif**: kimse kimseye gitmiyor.
Mavi ikmal aracı 103sn'de öldü. Sorun gerçek ve büyük görünüyordu.

**Kural yazıldı** (`js/Unit.js` `_ikmaleGit`, gate `resupplyRun`): kuruyan birim en yakın canlı dost
ikmal kaynağına yürür, `PRO_RESUPPLY_BIRAK` oranına dolunca göreve döner. Histerezis (`_ikmalYolunda`)
salınımı keser. Kuru birim zaten ateş edemediği için bu kural `standoff`'u ezer.

**Katman 1 geçti** — mekanizma bağlıyor ve hedef metriği doğru yöne taşıyor:

| tohum | pro kapalı | pro, resup kapalı | pro, resup açık |
|---|---|---|---|
| 2024 | 19.2% | 0.1% | 0.1% |
| 3141 | 11.3% | 3.9% | **0.9%** |
| 777 | 4.8% | 2.7% | **0.2%** |

Kalan kuruluğun ~%75'i silindi.

**Katman 2 ELEDİ** — ordu daha çok ateş etmiyor:

| tohum | atış kapalı | atış açık |
|---|---|---|
| 2024 | 192 | 195 |
| 3141 | 318 | 329 |
| 777 | 226 | 191 |

Parametre süpürmesi de kurtaramadı (toplam atış): **kapalı 736** · 800px 730 · 1200px 721 · 2500px 715.
Yola çıkma maliyeti, kazanılan mühimmatı yiyor.

**Kök neden — kendi hatam:** teşhisi **pro KAPALI** yaptım (%19.2 kuruluk) ama deltayı **pro'ya**
bağladım. Pro yapılandırmasında sorun zaten küçüktü (%0.1-3.9). *Doğru sorun, yanlış yapılandırma.*
**Ders: teşhis, deltanın ÇALIŞACAĞI yapılandırmada yapılmalı.**

**Karar:** varsayılan KAPALI. Kod ve parametreler duruyor; determinizm doğrulandı
(`--forktest --withpro` `forkTutarli: true`). Katman 5 parametre araması veya intel4 tabanı için
yeniden değerlendirilebilir — intel4'te sorun %5-19 ve orada değer taşıyabilir.

**Maliyet:** ~5 dakika ölçüm. Bu beceri Katman 4'e (37+ tohumluk maç kapısı, ~3 dk × parametre başına)
gitseydi gürültünün içinde "belki kazanıyor" görünecekti. Kapı sisteminin varlık sebebi budur.

---

## 9. #20 HELO — teşhis beceriyi DEĞİŞTİRDİ, sonra beceri geçti

Kataloğa "#20 helo standoff — ATGM menzilinden vur" yazmıştım. Teşhis onu da çürüttü.

**Katman 1 teşhis (`tools/helo-teshis.js`, 3 tohum, pro AÇIK — #5'in dersi uygulandı):**

| ölçüm | saldıran helo | savunan helo |
|---|---|---|
| ateş mesafesi (kendi menzilinin) | **%92** | %86 |
| AA zarfında geçen süre | **%0-1** | %1-2 |
| **menzilinde hedef bulunan süre** | **%3-12** | %46-62 |
| ölürken mühimmat | **12/12 (TAM YÜKLE)** | 10-12/12 |

Standoff zaten mükemmel (%92 menzil), SEAD zaten çalışıyor (%0-1 AA zarfı). Eksik olan bunlar değil:
**helo hedefin bulunduğu yere gitmiyor.** 800₺'lik birim ana kuvvetle oyalanıyor, maçta 1-2 atış
yapıyor ve dolu şarjörle ölüyor. Savunan helo aynı sorunu yaşamıyor çünkü düşman ona geliyor.

**Beceri yeniden tanımlandı → `heloHunt`** (`js/Unit.js` `_heloAvlan`): menzilinde hedef yokken,
düşman AA'sının **örtmediği** en yakın vurulabilir düşmana yaklaş (kendi menzilinin `PRO_HELO_YAKLAS`
kesrine kadar). AA örtüsü hem hedefin hem **kendi konumunun** çevresinde kontrol edilir → SEAD
disiplini bozulmaz. `PRO_HELO_BEKLE_TIK` kısa boşluklarda fırlamayı engeller.

**Katman 1 GEÇTİ** — saldıran helo atış sayısı (izole A/B, yalnız `heloHunt` değişti):

| tohum | kapalı | açık |
|---|---|---|
| 2024 | 2, 1 | **10, 10** |
| 3141 | 2, 2 | **18, 17** |
| 777 | 3, 2 | **11, 9** |

~5×. Ve bunu **disiplini bozmadan** yapıyor: ateş mesafesi hâlâ menzilin %74-92'si, AA zarfı %0-5.

**Determinizm:** `--forktest --withpro` `forkTutarli: true` · `--liverepro` `divergenceVarMi: false`.

**Sıradaki:** Katman 2 (hasar ÷ maliyet — atış sayısı yalnız vekil metrik) ve Katman 3 (yan etki:
SİHA/nakliye helo bozuldu mu). Katman 4 maç kapısı demet hâlinde, `standoff` ile birlikte.

**Parametreler (aranabilir):** `PRO_HELO_AA_KACIN=1200` · `PRO_HELO_YAKLAS=0.85` · `PRO_HELO_BEKLE_TIK=20`

### 9b. `heloHunt` — Katman 2 ve 3

**Katman 2 (birim ekonomisi):** metrik = *imha edilen düşman değeri ÷ birim maliyeti*, forensik
akıştan `attackerId` + `lethal` ile atfedildi (atış sayısı yalnız vekildi; bu gerçek ekonomi).

| tohum | 2024 | 3141 | 777 | 11 | 202 | 333 | 4242 | 5150 | 6060 | **ort** |
|---|---|---|---|---|---|---|---|---|---|---|
| kapalı | 0.13 | 0.41 | 0.74 | 0.32 | 0.49 | 0.92 | 0.44 | 0 | 0 | **0.38** |
| açık | 0.18 | 1.52 | 1.28 | 0.99 | 1.21 | 1.00 | **0.11** | 0.43 | 0.42 | **0.79** |

9 tohumun 8'inde daha iyi; helo zarar eden birimden (<1.0) başabaşa geçiyor.
**Dürüst hata payı:** eşleştirilmiş testte fark anlamlı (t≈2.9), ama bu sim kaotik ve
eşleştirme varyansı düşürmüyor — eşleştirilmemiş bakışta p≈0.06, yani **sınırda**.
Yön 8/9 tutarlı, büyüklük geniş hata payında. Katman 2 GEÇTİ, ama "2× getiri" demek için
daha çok tohum gerekir.

**Katman 3 (yan etki):**
- **Nakliye helo:** kural silahsız birimi dışlıyor (`!st.weapons.length` → false). Etkilenmiyor. ✓
- **Kamikaze dron:** `singleUse` dışlanıyor. Etkilenmiyor. ✓
- **SİHA (armed_uav):** karışık ama net zararsız.
  seed3141 açık iyileşme (atış 3,0 → 4,4; hiç ateş etmeyen 2 → 0; ölen 2 → 1).
  seed2024 hafif düşüş (atış 6,6 → 4,4) ama ikisi de sağ ve ateş mesafesi %84 → %97 (daha güvenli).
  Kayıt için: SİHA'nın kendi teşhisi ayrıca yapılmalı — bu delta ona göre ayarlanmadı.

**Durum:** Katman 1 ✓ · Katman 2 ✓ (sınırda) · Katman 3 ✓ · Katman 4 BEKLİYOR (demet: `standoff` + `heloHunt`).

---

## 10. SÜRÜM TURNUVASI SONUCU (255 aday, düzeltilmiş mekanikle)

**Şampiyon: `KESIF-jammer-1` +1335 ±582 (35/48)** — sabit ölçü çubuğunu (REF-H0-sezgisel) anlamlı
biçimde yeniyor ("sıfırdan ayırt edilebilir: EVET").

**Ama şampiyon takipçilerinden AYIRT EDİLEMİYOR:**

| aday | marj | galibiyet | zorunlu birim |
|---|---|---|---|
| KESIF-jammer-1 | +1335 ±582 | 35/48 | **ew_vehicle** |
| ORN-244 | +1296 ±701 | **36/48** | — |
| ORN-180 | +1234 ±604 | **36/48** | — |
| SUP-armor-x2 | +1162 ±647 | 35/48 | — |
| ORN-176 | +915 ±571 | 34/48 | command_vehicle |

Güven aralıkları örtüşüyor ve iki aday daha ÇOK maç kazandı (36 vs 35) — şampiyonluk marjdan geldi.
**Desteklenen:** "beş adaylık bir üst grup referansı yeniyor." **Desteklenmeyen:** "KESIF-jammer-1 en iyisi."

**Bütçe kesintisi:** final turu 6×96=576 maç planlanmıştı; aday başına 48 tohum koşuldu ve
5 elemenin 4'ü kanıtla değil BÜTÇEYLE yapıldı. Bilgi kaybı kayda geçti.

### Kör-nokta birimleri (kullanıcı isteği: "AI'nin hiç kullanmadığı birimleri de denemesini istiyorum")

| birim | ulaştığı en ileri tur |
|---|---|
| **ew_vehicle (jammer)** | **4 — ŞAMPİYON** |
| **command_vehicle** | **4** |
| armed_uav (SİHA) | 3 |
| sam_battery · mlrs · attack_helo · counter_battery_radar | 2 |
| **ballistic_missile** | **1** (11 kombinasyonunun tamamı) |
| transport_helo | 1 |

Jammer iki BAĞIMSIZ koşuda da tepede çıktı (iptal edilen koşuda tur 2 lideri +2534±678,
bu koşuda +2562±678) — tekrarlanabilirlik güçlü sinyal.

### ÖNEMLİ ÇEKİNCE: turnuva becerileri KAPALI koşuyor

Turnuva `intel4` gövdesiyle koşuyor (`govde=intel4pro` olan aday YOK) → `standoff` ve `heloHunt`
**hiç bağlamadı.** Yani:
- **Balistik**, onu ateş ettiren beceri kapalıyken elendi.
- **Taarruz helosu**, atışını 5× artıran beceri kapalıyken tur 2'de düştü.

Bu tam olarak §0'daki tez: turnuva *"bu AI'ın kullanabildiği kompozisyonlar"* ı ölçüyor.
Beceriler kalıcılaşınca turnuva YENİDEN koşulmalı — asıl ilginç sonuç iki sıralamanın farkı olacak.

---

## 11. KATMAN 4 DEMET KAPISI — GEÇTİ (ayrılmış havuzda doğrulandı)

Demet: `standoff` + `heloHunt`. İki kol AYNI kompozisyon (`attack_helo:2` + `mlrs:1` zorunlu),
AYNI gövde (`intel4pro`), AYNI rakip (`REF-H0-sezgisel`). Tek fark iki beceri anahtarı.

| havuz | DEMET-AÇIK | DEMET-KAPALI | fark |
|---|---|---|---|
| dışörneklem (48) | 19/48 · −593 ±645 | 12/48 · −1326 ±583 | 733 |
| **FİNAL (48, ayrılmış)** | **23/48 · −133 ±633** | 15/48 · −1548 ±703 | **1415** |
| birleşik (96) | 42/96 · ≈−363 | 27/96 · ≈−1437 | ≈1074 |

Dışörneklem havuzunda fark **anlamlı değildi** (p≈0.10-0.13). Ayrılmış FİNAL havuzunda
**z≈2.9 (p≈0.003)**; birleşikte galibiyet oranı 42/96 vs 27/96 (p≈0.024), marj p≈0.001.
Üç-havuz tasarımının varlık sebebi tam buydu: tarama havuzunda "belki" olan şey, hiç
kullanılmamış havuzda tekrarlandı.

**Dürüst absolüt okuma:** demet açıkken kompozisyon HÂLÂ KAZANMIYOR (−133). Beceriler
kompozisyonu kazandırmıyor, **açığı kapatıyor**: "anlamlı kaybeden" → "beraberlikten ayırt
edilemez". Bu kompozisyon helo+ÇNRA içerecek şekilde ÖZELLİKLE seçildi; sonuç tüm
kompozisyonlara genellenemez.

**Yapılmadı:** demet içi geri-çıkarma (hangi beceri ne kadar taşıyor). `standoff` burada yalnız
ÇNRA'ya (600px ölü bölge) bağlıyor, `heloHunt` iki heloya. Ayrıştırmak ayrı bir koşu ister.

**Durum:** `standoff` ✅ · `heloHunt` ✅ (K1-K4 tamam) — ikisi de varsayılan AÇIK.

---

## 12. JAMMER UYARISI (kullanıcı gözlemi — ÖLÇÜLMEDİ, hipotez olarak kayıtta)

> **Kullanıcı:** "jammer dronlara karşı fazla güçlü; beceri geliştirmede sıra ona geldiğinde fark edersin."

Bu, turnuvanın manşet bulgusuyla doğrudan çelişebilir: `ew_vehicle` zorunlu aday İKİ bağımsız
koşuda da tepede çıktı (§10). Eğer jammer dronları sert biçimde etkisizleştiriyorsa, o şampiyonluk
bir **strateji keşfi değil DENGE ARTEFAKTI** olabilir — jammer "iyi bir seçim" olduğu için değil,
dron içeren rakip kompozisyonları kırdığı için kazanıyor olabilir.

**Test edilebilir ve ucuz** (mekanizma metriği, gürültüsüz):
1. Jammer başına etkisizleştirilen dron **değeri (₺)** ÷ jammer maliyeti — `JAMMED` ve `DRONE_LOST`
   lifeEvent'leri zaten kayıtlı, atfı `jammerId` taşıyor.
2. Rakip kompozisyonda dron **olmadığında** jammer'in getirisi ne oluyor? Artefakt ise sıfıra düşer.
3. Şampiyon adayı dronsuz rakibe karşı yeniden koştur — üstünlüğü kayboluyorsa hüküm kesinleşir.

**Karar:** jammer becerisi (#29 konumlandırma) yazılmadan ÖNCE bu ölçüm yapılacak. Denge artefaktı
çıkarsa doğru müdahale beceri değil, jamming gücünün ayarıdır — ve turnuva sonucu o düzeltmeden
SONRA yeniden okunmalıdır.

---

## 13. JAMMER ÖLÇÜMÜ — kullanıcı hipotezi KISMEN doğru, kısmen TERS

Kullanıcı: *"jammer dronlara karşı fazla güçlü."* Ölçüm iki ayrı gerçek buldu.

### (a) Kod-veri uyuşmazlığı — kullanıcı HAKLI (yerel etki)

`UnitData` jamming halesi `uavControlLoss: 0.75`, birim başına duyarlılık `jammable` 0.8-1.0 ilan
ediyor. Kod ikisini de yok sayıyordu: `if (this.jammable && ...)` yalnız **truthy** bakıyor →
baloncuğa giren dron **%100 felç**. Halenin `enemyAccuracy: -0.20` ve `enemyCommandRange: -0.5`
etkileri ise **hiç uygulanmamış** (js'de tek atıf yok).

**Düzeltme (`BATTLE_JAM_PARTIAL`, varsayılan açık):** RNG'siz görev-döngüsü — her tik
`uavControlLoss × jammable` kadar birikir, 1'i aşınca o tik karıştırılır. Uzun vadede
karıştırılan tik oranı tam olarak o değer olur.

| kol | Kamikaze Drone | Keşif İHA |
|---|---|---|
| TAM (eski) | %98 (hedef %100) | — |
| **KISMİ** | **%74** (hedef %75) ✓ | %0 |

Kamikaze boş-patlaması artık **karıştırılan tikleri** sayıyor, duvar saatini değil — aksi hâlde
%60 güçle karıştırılan dron da tam-felç gibi 5sn'de patlardı ve kısmilik anlamsızlaşırdı.

### (b) Küresel tablo — hipotezin TERSİ

| dron-ağırlıklı saldıran → | galibiyet | marj |
|---|---|---|
| SAV-**JAMMERLİ** | 27/48 | **+524** |
| SAV-JAMMERSİZ | 8/48 | **−1520** |

Savunan jammer aldığında dronlara karşı **çok daha kötü** oluyor (~2044 marj). Sebep: yarıçap
400px (11.43 kare × 35) = haritanın **%2.9'u**, üstelik konumlandırma becerisi yok → 2×480₺
silahsız birim net yük. Ayrıca 2×2 testi (jammer saldırıda): dronlu savunana karşı jammer'lı
saldıran +1140, jammer'sız +1731 — jammer taşımak burada da zarar.

**Çelişki yok:** etki *kademeli ve geniş* tasarlanmış, *ikili ve dar* kodlanmış. Oyuncu YEREL
mutlaklığı hissediyor; AI-vs-AI ise KÜRESEL etkisizliği ölçüyor.

**Kısmi düzeltmenin maç etkisi:** dron-ağırlıklı saldıran TAM'da +524 (27/48, anlamsız),
KISMİ'de +794 (33/48, anlamlı). Yön doğru; kollar arası fark 48 tohumda anlamlı değil (z≈0.6) —
beklendiği gibi, çünkü baloncuk zaten haritanın %2.9'u.

### (c) ÖLÜ TASARIM: keşif İHA'sı hiç karıştırılmıyordu

`recon_uav`'ın silahı yok (`"weapons": []`) → `engageCombat` jam bloğundan **önce** erken dönüyor.
Ölçüm: baloncukta 75 tik, karıştırılan **0**. Yani EH aracının en doğal hedefi (düşman gözünü
kör etmek) hiç çalışmıyordu.

**`BATTLE_JAM_RECON` eklendi ama VARSAYILAN KAPALI.** Açıldığında çalıştığı doğrulandı
(Keşif İHA %65, hedef %68). Açmak jammer'ı **güçlendirir** ve kullanıcı raporu ters yönde —
bu bir denge kararıdır, tek taraflı alınmadı.

**Kapılar:** forktest `true` · liverepro `false` · pdtest OK · defertest OK.
Yeni birim durumu (`_jamAcc`, `_jamTik`, `jammedLoss`) fork anlık görüntüsüne eklendi.

**Turnuva sonucuna etkisi:** §10'daki jammer şampiyonluğu bu ölçümlerle daha da şüpheli —
jammer bu testlerde net yük çıktı ve şampiyon zaten takipçilerinden ayırt edilemiyordu.
Muhtemelen gürültü. Jammer konumlandırma becerisi (#29) yazılırsa tablo değişebilir.

### 13b. `BATTLE_JAM_RECON` AÇILDI (kullanıcı kararı) — ve üçüncü bir ölü katman çıktı

Kullanıcı: *"çok garip, aslında güçlü bir araç ama jammeri iyi konuşlandıramıyor muhtemelen.
evet jammer için BATTLE_JAM_RECON açabilirsin."* Bu teşhis ölçümle birebir uyuştu.

**Açıldı — ve İLK HÂLİYLE HİÇBİR ŞEY DEĞİŞTİRMEDİ.** Marj birebir aynı (seed2024: −24 = −24;
48 tohumda 794 = 794). Sebep üçüncü bir ölü katmandı: **jamming yalnız ATEŞ ve HAREKET'i kesiyor,
GÖRÜŞÜ kesmiyordu.** Silahsız gözcü donuk hâlde bile görmeye devam ediyordu — oysa halenin ilan
ettiği şey `uavControlLoss`, yani **kontrol bağının kopması**. Bağ koptuysa görüntü de akmaz.

**Düzeltme (`js/globals.js` `canSee`):** karıştırılan `jammable` birim takım görüşüne katkı vermez.

**Mekanizma doğrulandı:** Kamikaze %74 (hedef %75) · Keşif İHA %65 (hedef %68) · görüş kesiliyor.

**Maç etkisi hâlâ küçük:** 794 → 851 (33/48 → 34/48), hata payı ±615 içinde. Ve bu **beklenen**
sonuç: jam baloncuğu haritanın %2.9'u; seed2024'te keşif İHA'sı maçın ~%1'ini baloncukta geçiriyor.

> **Kullanıcının teşhisi ölçümle onaylandı:** jammer güçlü bir araç, sorun onu KONUŞLANDIRAMAMAK.
> Mekanizma artık doğru olduğuna göre beceri **#29 jammer konumlandırma** ilk sıraya çıkıyor —
> ve artık ölçülebilir bir tavanı var: baloncuk kapsamını %2.9'dan yukarı taşıyan her beceri,
> doğrudan karşılığını görecek.

**Kapılar:** forktest `true` · liverepro `false` · pdtest OK · defertest OK.

---

## 14. #29 JAMMER KONUMLANDIRMA — KATMAN 1'DE ELENDİ (ikinci eleme)

Kullanıcının teşhisi ("jammeri iyi konuşlandıramıyor") doğruydu ama **benim çözümüm yanlıştı.**

**Önce iki ölçüm hatası düzeltildi (ikisi de kendi hatam):**
1. `TILE_PX` = **100**, 35 değil (globals.js'deki yorum bayattı). Jam yarıçapı 400px değil **1143px**,
   haritanın %2.9'u değil **%23'ü**. §13'teki "yarıçap küçük" açıklaması YANLIŞTI — düzeltildi.
2. Teşhis aracı tarifleri hiç uygulamıyordu (`battleBuildArmyManifest`'e `recipe:` geçilmemişti) ve
   kırmızıyı ÇİFT konuşlandırıyordu (`openBattlefieldSession` zaten `BATTLE_RECIPE_RED`'den kurar).
   İlk "kapsama %5.2" rakamı bu bozuk kurulumdan geliyordu.
3. İlk A/B'de kontrol kolunda pro TAMAMEN kapalıydı → fark tüm deltalara aitti. Kanıt: `bağlama:0`
   olan koşu bile tabandan farklı çıkmıştı. İzole edildi.

**Düzeltilmiş teşhis (izole, pro her iki kolda açık):** kapsama %13, jammerlar 120/127sn yaşıyor.

**Kural yazıldı** (`js/Unit.js` `_jammerKonuslan`): görülen düşman dronlarının merkezini baloncuğa al;
düşman ateşinden `PRO_JAM_TEHDIT` uzak dur; `PRO_JAM_DERINLIK` derinlik tavanı.

**KATMAN 1 ELEDİ:**

| kol | kapsama | jammer ölümü |
|---|---|---|
| KONTROL | **%13.0** | 120sn, 127sn |
| tehdit 900 / derinlik 0.75 | %6.8 | 45sn, 69sn |
| tehdit 1500 / derinlik 0.45 | %8.0 | 63sn, 97sn |
| tehdit 2000 / derinlik 0.35 | %13.0 (hiç bağlamadı) | 120sn, 127sn |

Jammer'ı hareket ettiren **her** ayar kapsamayı düşürüyor. Tek "güvenli" ayar beceriyi hiç
çalıştırmayan ayar.

**Kök neden — hipotez yanlıştı:** dron trafiği düşman kuvvetinin yanında. Oraya yaklaşan silahsız
300hp'lik birim ölüyor ve ölü jammer hiçbir şey örtmüyor. AI'ın mevcut "kütleyle kal" davranışı,
bu birim için zaten daha iyi.

**GELECEK YÖNÜ (yazılmadı):** dronu KOVALAMAK yerine dronun HEDEFİNİ örtmek — kendi topçu/komuta/
ikmal kümesinin üstüne şemsiye kurmak. Dron oraya zaten geliyor; jammer güvende kalır. Bu, aynı
kapıdan geçmek üzere ayrı bir beceri olarak sıraya alındı.

**Durum:** `jammerPost` varsayılan KAPALI. Kod+parametreler duruyor (Katman 5 araması için).

### 14b. Jam yarıçapı 1143px → 700px (kullanıcı denge kararı)

> **Kullanıcı:** "jammer çok büyük alana sahip olmaz; gerçek jammerlar da uzun menzilli ama biraz
> daha kısa olsa iyi olur, 700 px gibi."

`UnitData` jamming halesi `radius: 11.43` → **7.0** (1143px → 700px).

**Ölçülen sonuç (izole, pro her iki kolda açık):**

| | 1143px | **700px** |
|---|---|---|
| dron kapsaması | %13.0 | **%2.4** |
| jammer ömrü | 120/127sn | 151/213sn |
| dron-ağırlıklı saldıranın marjı (jammerli savunana karşı) | +794 (33/48) | **+1645 (40/48)** |
| (kıyas) jammersiz savunana karşı | −1520 (8/48) | −1520 (8/48) |

Oyuncu tarafındaki hedef sağlandı: dronlar artık çok daha az kısılıyor. **Bedeli:** AI-vs-AI'da
jammer neredeyse ölü birim — 2×480₺ silahsız birim %2.4 kapsama karşılığında taşınıyor ve
jammerli savunan, jammersiz savunandan **3165 marj** daha kötü durumda.

**Bu, "dronun hedefini örtme" fikrini zorunlu kılıyor.** 700px'lik baloncukla dron kovalamak
imkânsız; ama kendi topçu/komuta/ikmal kümesinin üstünde durmak 700px'e RAHAT sığar ve dron
zaten oraya geliyor. §14'te "gelecek yönü" olarak not edilen beceri artık tek makul seçenek.

**Kapılar:** forktest `true` · liverepro `false` · pdtest OK · defertest OK.

---

## 15. #10 YÖNLÜ ZIRH (`armorFace`) — KATMAN 1 ÇARPICI, KATMAN 2 ELEDİ (üçüncü eleme)

**Teşhis (`tools/zirh-teshis.js`, izole, pro her iki kolda açık):** yönlü-zırhlı birimlerin maruziyeti
ÖN %63 / YAN %27 / ARKA %10 — **%37'si zırhın zayıf tarafından.** Savunan MBT en kötüsü:
%42 / %56 / %1, yani zamanın yarıdan fazlasında yanını gösteriyor. MBT yan ×1.5, TD arka ×3.3.

**Sebep:** `facingAngle` önce HAREKET yönüne (`Unit.js:548`), sonra ATIŞ HEDEFİNE (`:560`) kuruluyor.
İkisi de *"beni kim vuruyor"* sorusunu sormuyor: A'ya ateş ederken B yandan vuruyor.

**Kural** (`_zirhYonlendir`, hareket+hedef yönünden SONRA çalışır): burnu, o an seni VURABİLEN
düşmanların hasar-ağırlıklı merkezine dön. Tehdit her yöndense dönme (`PRO_ARMORFACE_MIN_BASKINLIK`).

**KATMAN 1 — çarpıcı geçiş:**

| | ÖN | YAN | ARKA |
|---|---|---|---|
| kapalı | %63 | %27 | %10 |
| açık | **%96** | **%4** | **%0** |

Ve bedeli **sıfır**: yalnız yön değişiyor, birim yerinden oynamıyor — bugün elenen konumlandırma
becerilerinin (jammerPost, resupplyRun) aksine hareket maliyeti yok.

**KATMAN 2 — ELEDİ.** Zırhlı birim ömrü (yalnız MAVI'de pro, tek taraflı izolasyon):

| tohum | 2024 | 3141 | 777 | 11 | 202 | 333 | **ort** |
|---|---|---|---|---|---|---|---|
| kapalı | 113 | 144 | 124 | 90 | 98 | 73 | **107sn** |
| açık | 142 | **44** | 124 | 89 | 98 | 132 | **105sn** |

Sağ kalan zırhlı sayısı da değişmedi (5 tohumun 4'ünde birebir aynı, birinde kötüleşti).

**Muhtemel sebep (SINANMADI):** zırhlıya gelen hasarın çoğu yönün önemsiz olduğu kaynaklardan —
dolaylı ateş/patlama alanı, hava, shaped-charge AT. `facingDamageMult` yalnız doğrudan-ateş yolunda
okunuyor. Sınamak için **hasar kaynağı kırılımı** gerekir (ayrı teşhis, sıraya alındı).

**Durum:** varsayılan KAPALI. Kod+parametreler duruyor.

### Günün deseni: mekanizma kolay, ekonomi zor

| beceri | Katman 1 (mekanizma) | Katman 2 (ekonomi) | sonuç |
|---|---|---|---|
| `standoff` | ✅ 0→1 atış | ✅ | **AÇIK** (K4 de geçti) |
| `heloHunt` | ✅ atış ~5× | ✅ getiri 0.38→0.79 | **AÇIK** (K4 de geçti) |
| `resupplyRun` | ✅ kuruluk −%75 | ❌ atış artmadı | kapalı |
| `jammerPost` | ❌ kapsama düştü | — | kapalı |
| `armorFace` | ✅ zayıf-taraf %37→%4 | ❌ ömür değişmedi | kapalı |

**Mekanizma metriğini oynatmak kolay; birim ekonomisine dönüştürmek zor.** Katman 2 bugün üç
beceriden ikisini eledi ve her seferinde sebebi farklıydı (maliyet, hareket, yanlış hasar kaynağı).
Bu, kapı sisteminin en çok iş gören katmanı.

---

## 16. JAMMER ŞEMSİYESİ — taktik DOĞRU, ama AI bunu ZATEN yapıyor

> **Kullanıcı:** "jammer şemsiye taktiğini uygulaması en iyisi, ben de onu uyguluyorum."

Taktik doğru; #29'un (dron kovala) elenmesinden sonra 700px'lik yarıçapa uyan tek makul tasarım da
buydu. Yazıldı (`_jammerSemsiye`, gate `jammerUmbrella`): kendi yumuşak-değerli kümemizin
(dolaylı ateş + silahsız destek, maliyet-ağırlıklı) merkezine otur.

**Ölçüm gereksiz olduğunu gösterdi:**

| | KONTROL | ŞEMSİYE |
|---|---|---|
| jammer → yumuşak küme merkezi (seed2024) | **165px** | 246px |
| jammer → yumuşak küme merkezi (seed3141) | **146px** | 208px |
| kapsama seed2024 / 3141 / 777 | %2.4 / %1.3 / %1.0 | %1.9 / %1.2 / %0.5 |

Baloncuk 700px; jammer zaten kümenin **146-165px** yakınında duruyor, yani şemsiye ZATEN kurulu.
Beceri onu maliyet-ağırlıklı merkeze çekerek biraz uzaklaştırdı ve kapsamayı düşürdü.

**Asıl sınır konumlandırma değil, DÜŞMANIN DAVRANIŞI:** rakip AI'ın dronları bizim geri bölgemize
yeterince gelmiyor. %1-2'lik kapsama tavanını belirleyen şey bu.

**Kullanıcı deneyimiyle uyum (önemli):** oyuncu dronlarını değerli hedeflere sürdüğü için AI'ın
HAZIR şemsiyesine giriyor — jammer'ın "fazla güçlü" hissedilmesinin sebebi büyük olasılıkla budur.
Yani kullanıcının gözlemi de, AI'ın mevcut davranışı da tutarlı; eksik olan bir beceri değildi.
**AI-vs-AI tezgâhı bu senaryoyu üretemiyor** — ölçüm sınırı olarak kayda geçti.

**Durum:** `jammerUmbrella` varsayılan KAPALI (gereksiz). Kod duruyor.

---

## 17. ZIRHLI KONUŞLANDIRMA — teşhis müdahale KATMANINI değiştirdi

> **Kullanıcı:** "zırhlı birliklere gelirsek ön zırhlarını göstermeleri çok daha mantıklı; AI
> muhtemelen öylesine kötü bir konuma sokuyor ki zırhın bir anlamı kalmıyor."

Bu tespit **doğru çıktı** ve `armorFace`'in neden karşılık vermediğini açıkladı.

### (a) Hasar kaynağı — benim hipotezim YANLIŞTI

`armorFace` elenirken "hasarın çoğu dolaylı/patlama, o yüzden yön önemsiz" diye tahmin etmiştim.
Ölçüm (`tools/zirh-hasar-teshis.js`) bunu çürüttü:

| kaynak | vuruş payı | öldüren payı |
|---|---|---|
| **DIRECT_FIRE** | **%76** | %67 |
| ARTILLERY_SPLASH | %22 | %0 |
| KAMIKAZE_IMPACT | %2 | %33 |

Yön çarpanı hasarın **dörtte üçünde zaten okunuyor.** Sorun 'yön' değil.

### (b) Ölüm bağlamı — kullanıcı haklı

| zırhlı öldüğü an | 600px dost | 1200px düşman |
|---|---|---|
| M 24sn (derinlik 0.47) | 2 | **14** |
| M 52sn (derinlik 0.46) | 4 | **17** |
| M 69sn (derinlik 0.44) | 6 | 6 |
| **ORT.** | **4** | **12.3** |

**1:3 yerel dezavantaj.** O oranda ×1.5'lik yan-zırh çarpanının hiçbir önemi yok — nitekim
`armorFace` maruziyeti %37→%4 düşürdüğü hâlde ömrü değiştirmedi.

### (c) Yazılan kural HİÇ BAĞLAMADI — ve bu asıl bulgu

`localRatio` (yerel dost/düşman oranı eşiğin altındaysa kapatma) yazıldı: **0 tik bağladı.**
Sebep: kural `!standOff` koşuluna bağlıydı, ama o noktada `standOff` ZATEN true oluyor
(duruş kapısı `standOff = !gate.open` veya `range` deltası menzil≥520 için).

> **Zırhlı ilerlediği için ölmüyor. Zaten menzilde duruyor; DÜŞMAN onun üstüne geliyor.**

Ölüm derinlikleri (0.44-0.47 = orta hat) bunu doğruluyor: savunan zırhlı kendi bölgesinde değil,
ortada ve 1:3'te ölüyor. Bu, kapalı duran `holdZone` deltasıyla aynı kök soruna bakıyor.

**MÜDAHALE KATMANI DEĞİŞTİ:** birim-içi "kapatma kapısı" bu sorunu çözemez. Doğru katman
**kontrolör seviyesinde KUVVET DAĞILIMI** — savunan kütlesini nereye koyuyor, neden ince yayılıyor,
düşman yığınağı karşısında neden yoğunlaşmıyor. Bu, birim becerisi değil operasyon becerisidir ve
`holdZone` + sektör-komuta altyapısıyla birlikte ele alınmalı.

**Durum:** `localRatio` varsayılan KAPALI (hiç bağlamıyor). `armorFace` de kapalı.
Zırhlı için sıradaki iş birim katmanında DEĞİL.

---

## 18. OPERASYON KATMANI: kuvvet dağılımı — mekanizma metriği MAÇI TERS TAHMİN ETTİ

Zırhlı teşhisi buraya işaret etmişti (birim değil kütle sorunu). Kullanıcı (a) şıkkını seçti.

### (a) Teşhis: savunan, saldıranın ana çabasıyla eşleşmiyor

Sektör = X-bandı (3 sütun; taarruz ekseni Y). Değer = ₺.
*(İlk kurulumum 3×2 idi ve erken oyunda "düşman kendi yarısında"yı "eşleşemedik" sanıyordu — düzeltildi.)*

| an (seed2024) | saldıran yoğunlaşma | savunan yoğunlaşma | ana-sektör oranı | savunan ₺ |
|---|---|---|---|---|
| t=10 | **0.598** | 0.374 | 0.67 | 6490 |
| t=70 | 0.602 | 0.606 | 0.96 | 5040 |
| t=130 | **0.867** | 0.505 | **0** | **600** |

Saldıran daha **temas olmadan** yoğunlaşmış; savunan yayılmış. Saldıran ağırlığını tek sütuna
yığdıkça savunanın ana-sektör oranı 0.96 → 0'a düşüyor ve hemen ardından kuvveti eriyor.

### (b) Altyapı: sektör-komuta TARAF-BAŞI yapıldı

A/B imkânsızdı çünkü `BATTLE_SECTOR_COMMAND` **global**: kapatınca iki taraf birden bloblaşıyor.
Diğer tüm beyin bayrakları (INTEL4/INTEL4PRO/BEONAI/RECIPE) zaten taraf-başıydı; bu da hizalandı:
`BATTLE_SECTOR_COMMAND_RED/BLUE` + `battleSectorCommand(isRed)` (null = global).
7 çağrı noktası güncellendi; `planningRoleShares` taraf parametresi almıyordu, eklendi.
**Regresyon kontrolü:** varsayılanlarda taban birebir yeniden üretildi (0.772 / 0.58 / 1051px / 0.47).

### (c) Tek taraflı izolasyon: kapatmak savunanı YOĞUNLAŞTIRIYOR

| tohum | savunan sektör AÇIK | savunan sektör KAPALI |
|---|---|---|
| 2024 | yoğunlaşma 0.58 · ana-sektör oranı **0.47** | 0.961 · **2.88** |
| 3141 | 0.698 · **0.20** | 0.787 · **1.60** |
| 777 | 0.538 · **0.58** | 0.864 · **2.15** |

Kapatınca savunan yoğunlaşıyor ve saldıranın ana çabasında **3-8× daha iyi yerel oran** kuruyor.
Mekanizma metriği "yoğunlaş" diyor.

### (d) MAÇ KAPISI TERSİNİ SÖYLEDİ

| savunan | saldıranın marjı | saldıran galibiyeti |
|---|---|---|
| sektör AÇIK | +1731 ±604 | 39/48 |
| sektör **KAPALI** (yoğunlaşan) | **+2715 ±334** | **46/48** |

Savunan yoğunlaştığında — ana-sektörde 3-8× daha iyi yerel orana rağmen — **belirgin biçimde
daha kötü**. Yoğunlaşmak 2 sütunu boş bırakıyor ve maç yalnız "düşman kütlesiyle eşleşme"yle
kazanılmıyor.

**Hipotezim yanlıştı; mevcut tasarım doğruymuş.** Sektör-komuta savunan için DOĞRU ve bu, ilk kez
TARAF-BAŞI temiz izolasyonla doğrulandı (bellekteki "3/3 vs 2/3" ölçümü global ve eskiydi).

### ⚠ METODOLOJİK DERS — plana kalıcı olarak eklendi

**Bir mekanizma metriği maç sonucunu TERS tahmin edebilir.** "Ana-sektör oranı" makul, ölçülebilir
ve gürültüsüzdü — ve tam ters yönü işaret etti. Katman 1'in ucuzluğu, metriğin doğru amacı ölçtüğü
varsayımına dayanıyor.

> **Yeni kural:** her yeni metrik ailesi, ilk kullanımında BİR KEZ maç kapısına karşı
> doğrulanmalı ("bu metrik yükselince maç da kazanılıyor mu?"). Doğrulanmamış metrik ailesiyle
> beceri elemek, yanlış yöne hızlı koşmaktır.

Bugün geçen iki beceri (`standoff`, `heloHunt`) bu riski taşımıyor çünkü metrikleri
(atış sayısı, imha değeri) doğrudan sonuçla bağlantılıydı ve ikisi de Katman 4'ü ayrıca geçti.

### (e) ASIL AÇIK PROBLEM

Savunan, sektör-komuta AÇIKKEN bile **39/48 kaybediyor**. Kuvvet dağılımı buradaki kaldıraç değil.
Bu, bellekteki "saldıran üstünlüğü" krizinin devamı ve `holdZone`'un kapalı olmasıyla aynı aileden.
Sıradaki soru: savunan neden kaybediyor — kompozisyon mu, duruş mu, hedef/arazi mi?

**Kapılar:** forktest `true` · liverepro `false` · defertest OK · pdtest OK.

---

## 19. SAVUNANIN DOLAYLI ATEŞİ — teşhis kesin, çözüm birim katmanında DEĞİL

> **Kullanıcı:** "savunmanın dolaylıları ne güne duruyor."

**Teşhis (`tools/dolayli-bos-teshis.js`) beş sebebi ayırdı ve tek bir sebebe indirdi:**

| sebep | pay |
|---|---|
| **(a) menzilde düşman YOK** | **%48** |
| kuru (mühimmat bitmiş) | %12 |
| (b) ölü bölge · (c) görünmez · (d) hedefleme filtresi | **%0** |
| (e) bilinmeyen mekanik engel | %4 |
| hedefli (çalışıyor) | %36 |

Görüş değil, ölü bölge değil, hedefleme değil — **konum**. Ve birim kırılımı iki AYRI sorun gösterdi:

| birim | menzil | en yakın düşman | hattının gerisinde | asıl sorunu |
|---|---|---|---|---|
| **Havan** | 900px | **1165px (menzil DIŞI)** | 760px | **konum** |
| Topçu | 1500px | 1216px (menzil içi ✓) | 890px | **mühimmat** (%35 kuru) |

**Kural yazıldı** (`_dolayliYaklas`, gate `indirectCreep`): kısa menzilli dolaylı ateş, düşmanı
menzilin %80'ine alacak kadar ilerler — ama **kendi ön hattının gerisinde kalır** (bugün elenen
`jammerPost` tam da öne çıkıp öldüğü için düşmüştü).

**KATMAN 1 ELEDİ.** Mekanizma çalıştı (havan 760px → 350px), hedef metriği oynamadı:

| tohum | kapalı | açık |
|---|---|---|
| 2024 | 445 örnek, %65 menzil-yok | 170 örnek (2.6× erken öldü), %65 |
| 3141 | 288 örnek, %26 | 151 örnek, %26 |
| 777 | 166 örnek, %48 | 1460 örnek, %12 — ama **%54 GÖRÜNMEZ** |

Öne çıkmak menzil sorununu **görüş sorununa takas ediyor** ve hayatta kalma savruluyor.

**DAHA DERİN SEBEP — ve günün ikinci kez aynı yere varması:** havanın menzilinde düşman
olmamasının kaynağı havanın kendi konumu değil, **savunan kuvvetin tamamının geride ve yayılmış
durması.** Zırhlı teşhisi (§17) de tam buraya varmıştı. Savunan tarafta birim-katmanı becerileri
üst üste eleniyor çünkü sorun beceri değil **duruş/yapı**.

### Günün deseni netleşti: saldıran becerileri geçiyor, savunan becerileri elenmiyor

| beceri | taraf | sonuç |
|---|---|---|
| `standoff` | saldıran/genel | ✅ K1-K4 geçti |
| `heloHunt` | saldıran | ✅ K1-K4 geçti |
| `resupplyRun` | savunan ağırlıklı | ❌ K2 |
| `jammerPost` | savunan | ❌ K1 |
| `jammerUmbrella` | savunan | ❌ zaten yapılıyor |
| `armorFace` | savunan ağırlıklı | ❌ K2 |
| `localRatio` | savunan | ❌ hiç bağlamadı |
| `indirectCreep` | savunan | ❌ K1 |

**Altı savunan becerisi arka arkaya elendi.** Bu artık tesadüf değil, bir bulgu:
savunanın kaybetmesinin sebebi birim davranışı değil. Ve kuvvet dağılımı ölçümü (§18)
"yoğunlaş" çözümünü de eledi — savunan yoğunlaşınca DAHA KÖTÜ oluyor.
Geriye kalan adaylar: **kompozisyon** (savunan bütçesinin yalnız %7'si dolaylı) ve
**kazanma koşulu/arazi** (savunanı ileri çeken bir şey var mı).

---

## 20. İKMAL REFAKATİ — doktrin DOĞRU, kısıt BAŞKA YERDE (7. eleme)

> **Kullanıcı:** "hem kompozisyon sorunu hem de mühimmat sorunu; topçuların yakınında sürekli bir
> ikmal aracı şart."

Bu, elenen `resupplyRun`un **tersi**: orada topçu ikmale gidiyordu (mevziini terk etti, K2'de düştü);
burada **araç topçuya gelir**. Doğru tasarım — ve ölçüm boşluğun gerçek olduğunu doğruladı:

| ölçüm (kapalı) | değer |
|---|---|
| dolaylı birim ikmal halesinde geçen süre | **%16** |
| kuru geçen süre | %12 |
| araç → dolaylı-küme merkezi mesafe | **712px** (hale 400px) |

**Kural yazıldı** (`_ikmalRefakat`, gate `supplyEscort`): ihtiyaç-ağırlıklı müşteri merkezine otur
(dolaylıya ×3 ağırlık), düşman ateşinden uzak dur.

**Mekanizma çalıştı:** mesafe 712px → **442px**, hale içinde süre %16 → %27
(yer olan tohumlarda %23→%64, %24→%56).

**Ama atışa dönmedi** (9 tohum, toplam dolaylı atış):

| tohum | 2024 | 3141 | 777 | 11 | 202 | 333 | 4242 | 5150 | 6060 | **ort** |
|---|---|---|---|---|---|---|---|---|---|---|
| kapalı | 33 | 32 | 20 | 16 | 16 | 59 | 40 | 25 | 2 | **27.0** |
| açık | **81** | 20 | 10 | 27 | 11 | 38 | 17 | **106** | 24 | **37.1** |

4 tohum iyi / 5 tohum kötü. Fark +10.1 ama **SE ±11.7 → sıfırdan ayırt edilemiyor.**

**SEBEP — ve bu bulgu deltadan daha değerli:** mühimmat **bağlayıcı kısıt değil.**
Dolaylı birim KURU geçen süre %12, **HEDEFSİZ** geçen süre %48. Mermi yetiştirmek, ateş edecek
hedef yokken atış üretmez. Kanıt: kapsaması zaten %83-85 olan tohumlarda bile atış 16-20'de kalıyor.

**Durum:** varsayılan KAPALI, kod duruyor. Hedef sorunu (savunan duruşu/kompozisyonu) çözülürse
bu kural yeniden anlam kazanır — sıraya alındı.

**Kompozisyon öngörüsü (turnuva sınayacak):** savunan bütçesinin %7'si dolaylı. Dolaylı birimler
zamanın %48'inde hedefsizken **daha çok dolaylı almak israf olmalı.** Akşamki turnuva bu öngörüyü
doğrudan test edecek: `SUP-indirect-*` aileleri hem artırılmış hem azaltılmış payları taşıyor.

---

## 21. DOLAYLI ATEŞ BECERİ AĞACI — kapanış: tek bağlayıcı kısıt MESAFE

Kullanıcı bu dizinin bir "beceri ağacı" olduğunu isabetle adlandırdı. Ağaç artık büyük ölçüde
taranmış durumda ve tek bir kısıta indirgeniyor.

### (a) "Nasıl hedefsiz kalıyorlar?" — sektör hipotezi ÇÜRÜDÜ

> **Kullanıcı:** "nasıl hedefsiz kalabiliyor, saldıran birimler direkt savunmaya saldırıyorsa?"

Hipotezim: savunan 3 sütuna yayılıyor, saldıran 1 sütuna yığılıyor → dolaylının 2/3'ü boş sütunda.
**Ölçüm %100 çürüttü** (3 tohum): "menzilde düşman yok" anlarının **%100'ünde düşman AYNI SÜTUNDA**,
yalnızca menzil dışında. Boşta değiller — **erişemiyorlar**. Havan menzili 900px, düşman 1165px'te,
havan kendi hattının 760px gerisinde. Saldıran savunanın HATTINA saldırıyor; havan hattın gerisinde.

### (b) Kompozisyon: dolaylı payı %4 ↔ %18 arası HİÇBİR FARK yaratmıyor

Kullanıcı isteği: "dolaylı gücünü savunmada %12 seviyesine çıkarmayı da test et."

| savunan dolaylı payı | dışörneklem havuzu | **FİNAL havuzu (ayrılmış)** |
|---|---|---|
| %4 | +903 ±741 (29/48) | **+1055 ±666 (32/48)** |
| %12.6 (taban) | +1731 ±604 (39/48) | **+1162 ±693 (33/48)** |
| %18 | +996 ±835 (30/48) | **+1041 ±722 (32/48)** |

*(saldıranın marjı — düşük olan savunan için iyi)*

Tarama havuzu %4'ü belirgin iyi gösteriyordu (828 marj farkı, "anlamlı"). **Ayrılmış havuzda
tamamen kayboldu.** Üç-havuz disiplini bir kez daha sahte bulgu yakaladı.

**Sebep tutarlı:** dolaylı birim zamanın %48'inde hedefsiz. Kaç tane aldığın önemli değilse,
onları BESLEMEK de (§20 ikmal refakati) önemli değil. İkisi de aynı kısıta çarpıyor.

### (c) Ağacın kapanış tablosu

| müdahale | katman | sonuç |
|---|---|---|
| **boş namlu mekanik hatası** | mekanik | ✅ **düzeltildi** (ilk atış 67sn→6sn) |
| **`standoff`** (ölü bölge) | birim | ✅ **K1-K4 geçti** |
| gözcü bağı | birim | ✗ gerek yok (görüş kaynaklı yalnız %9.4) |
| `indirectCreep` (öne al) | birim | ✗ K1 (menzil sorununu görüşe takas etti) |
| `resupplyRun` (topçu ikmale gitsin) | birim | ✗ K2 (mevzi maliyeti) |
| `supplyEscort` (araç topçuya gelsin) | birim | ✗ mühimmat bağlayıcı kısıt değil |
| dolaylı payı %4/%12/%18 | kompozisyon | ✗ fark yok (FİNAL havuzunda doğrulandı) |

**Ağaçtan çıkan tek gerçek kazanç mekanik düzeltmesi ve `standoff` oldu.** Kalan her şey
aynı duvara çarpıyor: **dolaylı ateşin menzilinde düşman yok** — ve bu, dolaylı biriminin
kendi sorunu değil, savunan kuvvetin nerede durduğunun sonucu.


---

## 22. transport_helo (nakliye helikopteri) — İNCELENDİ

**Tetikleyen:** kullanıcı oyundan iki gözlem bildirdi — *"nakliye heloları birim taşırken çok
titriyordu"* ve *"her şeyi taşımaya çalışıyor, sürekli bir şey taşımasına gerek yok"*. İkisi de
doğru çıktı; ölçüm (`tools/nakliye-teshis.js`, 6 tohum, gerçekçi ordu + `zorunlu:{transport_helo:2}`)
tabanı şöyleydi: 12 helo ömrünün **%68'ini yüklü** geçirdi, **11'i öldü** (7'si yakıtı bitip
düşerek), helo başına yalnız ~2.7 yolcu taşındı ve hareketli tiklerin **%74.8'i yön-tersine-dönüş**.

### Dört ayrı kusur

1. **Ayırma fiziği `loaded` yolcuyu elemiyordu** (`js/Unit.js`, çarpışma döngüsü). Yolcular her tik
   taşıyıcının tam aynı koordinatına konuyor (`p.x = this.x`), mesafe ~0 olunca `dist <= 0.01`
   dalı devreye girip **helo ile kendi kargosunu** `MIN_DIST/2` kadar itiyordu. Titreme bu yüzden
   *yalnız yük varken* görülüyordu — kullanıcının tarifi birebir buydu. **Asıl kök-neden budur.**
2. **Kabul listesi çok geniş:** `armorType === 'infantry'` olan her şey alınıyordu — havan (dolaylı,
   mevzi ister), MANPADS (hava savunması), sıhhiyeci ve **istihkâm**. İstihkâm helipadi kuran
   birimdir; ferry onu cepheye taşıyınca helonun ikmal üssü hiç kurulmuyordu (kapalı döngü).
   → `_ferryUygun()`: yalnız `infantry` / `at_team` / `commando`. Oyuncunun manuel emri etkilenmez.
3. **Tek yolcuyla sefer:** `cargo.length > 0` olur olmaz teslime kalkıyordu; 6 slotun 5'i boş
   gidiyordu. → slotlar dolana ya da yakında aday kalmayana kadar topla (`_ferryKalkti`).
4. **Amaçsız sürekli taşıma:** yolcu cepheye zaten yakınken de sırtlanıyordu. → `FERRY_MIN_KAZANC`
   (harita yüksekliğinin %22'sinden yakınsa taşıma) + boşta en yakın helipada dönüp bekleme.

Ek olarak `updateFuel`'deki `!busyTransport` koşulu yüklü helonun yakıt için **asla** üsse
dönmemesine yol açıyordu (taban yok); `BATTLE_HELO_KRITIK_YAKIT = 0.12` ile kargo şartı kritik
yakıtta düşüyor. Tek başına etkisi küçüktü (YAKIT ölümü 10→9), asıl fayda ferry düzeltmesindendi.

### Ölçülen sonuç (6 tohum, izole A/B — `--eskiferry`)

| | eski | yeni |
|---|---|---|
| titreme (yön-tersine-dönüş) | %74.8 | **%3.9** |
| yüklenen / indirilen piyade | 32 / 24 | **44 / 32** |
| yüklü geçen süre | %68 | %45 |
| içeride ölen piyade | 8 | 12 |
| **kayıp oranı (içeride ölen ÷ yüklenen)** | %25 | %27 |

**Dürüst okuma:** titreme kökten çözüldü ve teslimat +%33 arttı; **kargo kayıp oranı değişmedi**,
mutlak sayı arttı çünkü helo artık gerçekten taşıyor. İlk raporladığım "kargo ölümleri 6→0" ifadesi
3 tohumluk bir koşuya dayanıyordu ve **yanlıştı** (bkz. `OLCUM-TUZAKLARI.md` C6).

**Determinizm:** `--forktest` → `forkTutarli: true`, sapma yok. Yeni birim alanları
(`_ferryKalkti`, `_ferryPickId`, `_ferryHover`, `_ferryBosaltiyor`, `_ferryTeslimX/Y`) anlık-durum
beyaz listesine eklendi.

**Bayraklar:** `BATTLE_FERRY_FIX` (varsayılan açık, kapatınca eski davranış), `FERRY_MIN_KAZANC`,
`FERRY_TOPLA_YARICAP`, `BATTLE_HELO_KRITIK_YAKIT`.

### Açık kalan (K2'ye girmeden önce karar gerektirir)

- **Helipad 60 saniyede siliniyor** (`SUPPLY_FIELD_DURATION_MS = 60000`, `main.js` temizliği).
  360sn'lik maçta kalıcı hava ikmali imkânsız; helo ölümlerinin 10'da 8'i hâlâ yakıt. İstihkâmın
  kurduğu `providesAir` alanına ayrı (uzun) ömür vermek bir **denge** kararıdır, beceri değil.
- **K2 (birim ekonomisi) yapılmadı:** transport_helo'nun 400₺'sinin hasar/₺ ve emilen-hasar
  karşılığı ölçülmedi. Mekanizma kapısı (K1) geçildi, ekonomi kapısı açık.

### Yeni araç

`tools/helo-titreme-iz.js` — yüklü bir helonun ardışık tiklerini (konum, adım, targetX/Y,
manualMoveTarget, hold, unstick, kargo) aynen döker. "Hangi yazıcı hedefi eziyor" sorusunu
tahminle değil dökümle çözer; ilerideki hareket hatalarında ilk başvurulacak araç.

### 22b. "İstihkâm neden siper kazmıyor?" — kullanıcı sorusu, ölçüldü

Helolar yakıtsızlıktan düşerken istihkâmın niye çalışmadığı soruldu. `tools/istihkam-teshis.js`
(3 tohum) üç ayrı şeyi ayırdı: **kapsama** (maçın ne kadarında yaşayan helipad var), **engel**
(istihkâm kurmuyorsa neden) ve **erişim** (helo düşük yakıttayken üs var mıydı, kaç px ötede).

**Taban:** kapsama maçın yalnız **%40'ı**; istihkâm ölmüyor (0/3) ve 3 maçta 11 kez kuruyor —
yani tembel değil. Engel dağılımı: `KENDI-YARISINDA-DEGIL` **%38.6**, `ZATEN-ALAN-VAR` %51.7,
`INSA-EDIYOR` %5.3, `BASTIRILMIS` %3.2. Yani saldıran orduda istihkâm orduyla birlikte orta hattı
geçiyor ve `inOwnHalf` kapısı yüzünden **tam da helonun ikmale ihtiyaç duyduğu bölgede** kurmayı
reddediyor. Güvenliği zaten 360px'lik `closeThreat` kapısı sağlıyordu; yarı-saha çizgisi fazladan.

**Denenen:** taraf-başı pro-delta `engineerForward` (+ `PRO_IST_ILERI_DERINLIK = 0.75`).

| | kapalı | açık |
|---|---|---|
| `KENDI-YARISINDA-DEGIL` | %38.6 | **%0.3** |
| helo düşük yakıttayken üs vardı | %16 | **%31** |
| en yakın üs mesafesi | 694px | **506px** |
| helipad kapsaması | %40 | %46 |
| istihkâm ölümü | 0/3 | 0/3 |

**Durum: K1 geçti, VARSAYILAN KAPALI.** Erişim ikiye katlandı ve istihkâm ölmüyor, ama bu yalnız
mekanizma kapısı (3 tohum) — maç kapısına (K4) girmeden açılmaz. Ayrıca kapsamanın %46'da
takılmasının sebebi delta değil: helipad 60sn'de siliniyor ve istihkâm yalnız **kendi çevresinde**
520px'te alan yoksa yeniden kuruyor. Kalıcı hava ikmali istiyorsak `SUPPLY_FIELD_DURATION_MS`
ayrımı (istihkâm-yapımı alana ayrı ömür) gerekir — bu bir **denge** kararıdır, kullanıcıya aittir.

**Geri alınan iddia:** "kurma kapısı `providesAir` aramıyor, herhangi bir ikmal alanı yeterli
sayılıyor" dedim — YANLIŞ. `SIM.trenches.push` tek yerde (istihkâm) ve her alan `providesAir: true`.

---

## 23. command_vehicle (komuta aracı) — İNCELENDİ

600₺, silahsız, `hp 400 / light / armor 3 / speed 1.5`, hale yarıçapı 12 kare = **1200px**,
`roleTags: high_value_target`. Ölçüm aracı: `tools/komuta-teshis.js` (3 tohum, gerçekçi ordu +
`zorunlu:{command_vehicle:1}`).

### Ölü veri (kodda karşılığı YOK)

Aura verisinde dört etki tanımlı: `accuracy +0.12`, `range +0.08`, `orderLatency -0.4`,
`suppressionResist 0.25`. Kodda karşılığı olan: **+%12 hasar** (`commandHaloTick`, `performAttack`),
baskı −12/sn, panik −9/−22/sn ve **rally** (kaçanı durdurma). **`range +0.08` ve
`orderLatency -0.4` hiçbir yerde okunmuyor** — menzil çarpanı hiç uygulanmıyor. Bu bir denge
değişikliği olacağı için uygulanmadı, açık madde olarak kaydedildi.

### Taban ölçümü

| | değer |
|---|---|
| hale dost DEĞERİN | %83'ünü tutuyor |
| dost hasarın | %73'ü hale içinde veriliyor |
| halenin kazandırdığı hasar | ~1379 / 3 maç → **0.77 hasar/₺** |
| kütle merkezine uzaklık | 539px |
| ölüm | **2/3** (74sn ve 185sn); öldüren: tank_destroyer, mbt |
| rally | 4 |

Aracın kendisi silahsız olduğu için tüm doğrudan getirisi bu +%12'lik paydır: 0.77 hasar/₺, bir
muharebe biriminin doğrudan getirisinin yaklaşık beşte biri — üstüne rally + baskı/panik giderme
ve ölünce dostlara `command_shock` cezası biner.

### Yanlışlanan sezgi (karşı-olgu ölçümü)

İlk hipotez: "HVT, geriye çekilsin, ölmesin." **Karşı-olgu bunu yalanladı:** 500px daha geri
çekilse kapsama **%83 → %48**'e düşüyordu. Üstelik işaretli konum ölçümü aracın zaten kütle
merkezinin **436px ARKASINDA** olduğunu gösterdi — geri değil, ileri gitmesi gerekiyordu:
tam merkezde otursa kapsama **%92** olurdu.

### Denenen beceri: `commandCenter` (pro-delta, taraf-başı)

`_komutaMerkez()` — komuta halesi taşıyan birim dost değer-ağırlıklı kütle merkezine yönelir;
`PRO_KOMUTA_OLU_BOLGE = 200` ölü bölgesi içindeyse **durur** (ferry titreme dersi uygulandı).

| | kapalı | açık |
|---|---|---|
| kapsama | %83 | **%93** |
| merkeze uzaklık | 539px | **178px** |
| hale içi hasar payı | %73 | **%87** |
| halenin kazandırdığı hasar | 1379 (0.77/₺) | **1585 (0.88/₺)** |
| rally | 4 | **9** |
| ölüm | 2/3 | 2/3 |
| ortalama marj | −484 | **−1368** |

**Durum: K1 geçti, VARSAYILAN KAPALI.** Dört mekanizma metriği de düzeldi, maç marjı ise düştü —
tuzak C1'in aynısı. Ancak fark 884, marj std'si ~3114: 3 tohumda bu **ne iyileşme ne kötüleşme
kanıtıdır** (E3). Karar K4'e (37+ tohum, demet) bırakıldı.

### Araç tarafında düzeltilen ölçüm hatası

İlk koşuda "toplam hasar 0" çıktı ve bunu bulgu sanmadım — `BATTLE_FORENSIC` tamponu `damage`
alanı taşımıyordu (yalnız kimlik/tip/öldürücü/konum). `battleRecordCombatEvent` içine `damage`
eklendi (saf telemetri, sim'e dokunmaz). SAM'deki "0 atış" hatasının tekrarı önlendi.

### Açık maddeler

- `range +0.08` ve `orderLatency -0.4` uygulanmıyor (ölü veri) — denge kararı.
- K2 (birim ekonomisi) kısmen var (0.77-0.88 hasar/₺) ama emilen-hasar ve `command_shock` maliyeti
  ölçülmedi.

---

## 24. DEMET SAVAŞI — 6 güçlendirmenin toplu kapısı (K4)

Kullanıcı: *"şimdiye kadar 6 şeyi güçlendirdik, bu 6 şeyin güçlenmiş hali ile güçlenmemiş hali olan
deterministik bir savaş ortamı hazırla."* → `tools/demet-savas.js`.

**Demet üyeleri:** `spotterRequirement` (gözcü), `logisticsRequirement` (ikmal),
`airBaseRequirement` (üs), ferry düzeltmesi + kritik yakıt (nakliye helo), `engineerForward`
(istihkâm), `commandRange` (komuta menzili). `commandCenter` demete ALINMADI — K2'de elendi.

### Ortamın üç tasarım kararı

1. **Eşleştirilmiş fark:** aynı tohumda iki kol koşar, fark tohum-içi alınır. Marj std'si ~3114
   iken **eşleştirilmiş fark std'si 427** ölçüldü (doğal orduda 214). Bu olmadan 24 maçta hiçbir
   şey görülemezdi.
2. **Taraf-başı izolasyon (B3):** `battleProDelta` delta nesnesini GLOBAL okuyordu — demeti açınca
   mavi de alıyordu. `BATTLE_INTEL4PRO_DELTAS_RED/_BLUE` geçersiz kılma eklendi; ferry bayrakları
   da (`BATTLE_FERRY_FIX_RED/_BLUE`, `BATTLE_HELO_KRITIK_RED/_BLUE`) taraf-başı yapıldı.
3. **Bind kanıtı (B2) ve determinizm:** her koşu kırmızı kadronun kol-arası farkını yazdırır;
   `--determinizm` aynı kolu iki kez koşup birebir aynılığı kanıtlar (geçti).

### Bind kanıtının ortaya çıkardığı ASIL BULGU

Doğal (AI'nın kendi kurduğu) orduda demet **hiçbir şeyi değiştirmiyor** — çünkü o orduda
**ne nakliye helosu ne komuta aracı var**, gözcü/ikmal/istihkâm ise zaten mevcut:
`infantry 6, at_team 4, mortar_team 2, manpads_team 2, ifv 2, tank_destroyer 2, scout_vehicle 2,
artillery 1, medic 1, engineer 1, commando 1, mbt 1, spaag 1, recon_uav 1, supply_truck 1,
drone_operator 1`. Kurallar bağlamıyor değil, **düzeltecek bir şey bulamıyor**.

Bu, kullanıcının *"bu kadar zırhlı kullanmasının sebebi çok beceriksiz olması"* tespitiyle birebir
örtüşüyor: birimleri düzeltmek yetmiyor, AI onları **satın almıyor**.

### Sonuçlar (12 tohum × 2 rol × 2 kol)

| senaryo | eşl. fark | std.hata | t | demet lehine | KIRMIZI galibiyet |
|---|---|---|---|---|---|
| **birimli** (tarama havuzu) | **+3350** | 631 | **5.31** | 21/24 | **6/24 → 18/24** |
| **birimli** (AYRILMIŞ final havuzu) | **+2880** | 690 | **4.18** | 18/24 | **5/24 → 15/24** |
| doğal ordu (AI'nın kendi kurduğu) | +36 | 44 | 0.83 | 7/24 | 17/24 → 17/24 |

**Okuma — dürüst çerçeve:** birimli senaryoda "kapalı" kol, helo+komuta+MLRS içerip **destek
birimlerinden yoksun** bir ordudur; demet onu onarır (2 keşif İHA + 1 istihkâm + 1 ikmal aracı
ekler, karşılığında 2 tanksavar + 5 piyade satar). Yani ölçülen şey "iyi ordu → daha iyi ordu"
değil, **"desteksiz ordu → desteklenmiş ordu"**. Kuralların sigorta olarak çalıştığı kanıtlanmıştır
ve etki ayrılmış havuzda doğrulanmıştır. Ama demet, AI'nın **normal oyununu güçlendirmez** —
çünkü orada bağlayacak bir şey yok.

**Sıradaki doğal adım:** kompozisyon. Bu birimler artık çalıştığına göre AI'nın onları satın alması
değerlendirilmeli; bu, beceri katmanından **kompozisyon katmanına** geçiş demektir.

---

## 25. counter_battery_radar (Hava-Arama Radarı) — İNCELENDİ

350₺, silahsız, `hp 200 / light / armor 0`, görüş 20 kare, `airRadar: true`, `roleTags: fragile`.
Ölçüm: `tools/radar-teshis.js` (3 tohum, gerçekçi ordu + `zorunlu:{counter_battery_radar:1, mlrs:1}`).

### İkinci ölü veri — ama bu sefer SİLİNMEDİ, İŞARETLENDİ

Birimin aura'sı `{ type:"counter_battery", radius:30, effect:"reveals_indirect_shooter", duration:8 }`.
`updateAura` yalnız **heal / repair / resupply / command / jamming** tiplerini işliyor;
`counter_battery` hiç işlenmiyor. Komuta aracındaki `range: 0.08` ile aynı sınıf.

**İsim çakışması (dikkat):** `counterBattery` pro-deltası bu radarla İLGİSİZ — o, saldıranın kendi
dolaylı ateşinin düşman dolaylısını önceliklemesi (`Unit.js`, hedef skoru +400000). Ama
öncelikleyebilmek için görmek gerekir; görüntüyü sağlayacak radar aurası ise işlemiyor.

### Ölçüm: ifşa gerekli mi?

| soru | sonuç |
|---|---|
| düşman dolaylısı genel olarak görünür mü | %67 |
| **ateş ettiği ANDA görünür mü** | **%100** (176 dolaylı atış olayı) |
| radar 3000px kapsamında geçen süre | %95 |
| düşman dolaylısı kırmızı dolaylı MENZİLİNDE mi | %75 |
| radar ömrü | 295sn / 365sn (öldüren: mbt 1) |

**Karar: aura UYGULANMADI.** İfşa edeceği bilgi, tam da işe yarayacağı anda zaten mevcut. Bunu
uygulamak sıfır etki üretirdi — kompozisyon kurallarının doğal orduda hiçbir şeyi değiştirmemesiyle
aynı ders.

**Ama SİLİNMEDİ de.** `UnitFeatures.js` öznitelik 25 (`aura.type ? 1 : 0`) ve 26
(`norm(aura.radius, 0, 30)`) alanlarını okuyor; aura bloğunu silmek radarın öznitelik vektörünü
kaydırır ve eğitilmiş modellerin (kompozisyon vekili, beonai seçici) girdisini **sessizce** bozardı.
Veriye ölçümü açıklayan bir yorum eklendi. *(Not: komuta aracındaki `orderLatency` silinmesi
güvenliydi — `aura.effects` öznitelik kodlamasına girmiyor, yalnız `type` ve `radius` giriyor.)*

**Radar "fragile" değil:** roleTag öyle diyor ama ömrü 365sn'nin 295'i. Kırılganlığı bir sorun
olarak ele almaya gerek yok.

**Birimin gerçek değeri `airRadar`:** daha önce ölçülmüştü — orduya 1 hava radarı eklenince SAM
atışı 0→8, tam yükle ölen SAM 8→4, düşmanın uçak bulundurma süresi %100→%58. Bu birim
"karşı-batarya radarı" adıyla anılsa da işlevi hava aramadır.


---

## 26. KALAN BİRİMLER — doğru triaj (AI'nin GERÇEK ordusu)

İlk triaj tablosu `BATTLE_FORCE_VARIED` kipinde alınmıştı ve yanlış hedef gösterdi (bkz.
`OLCUM-TUZAKLARI.md` A5/A6). `--cesitsiz` ile AI'nin gerçekten kurduğu orduda, 6 tohum:

| birim | maliyet | ATIŞ | hedefli | ömür | GETİRİ | EMİLEN |
|---|---|---|---|---|---|---|
| scout_vehicle | 180 | 1.8 | %2 | 159sn | **x0** | 0.72 |
| mortar_team | 180 | 6.2 | %46 | 122sn | **x0.15** | 0.67 |
| **artillery** | **450** | 11.1 | **%82** | 125sn | **x0.21** | 0.51 |
| engineer | 200 | 9.2 | %4 | 365sn | x0.32 | 0.35 |
| ifv | 320 | 23.1 | %16 | 228sn | x0.42 | 1.14 |
| mbt | 500 | 8.4 | %11 | 262sn | x0.69 | 1.11 |
| manpads_team | 190 | 2.2 | %11 | **365sn** | x0.75 | 0.16 |
| spaag | 300 | 39.2 | %51 | 329sn | x0.82 | 0.44 |
| infantry | 100 | 13.8 | %7 | 220sn | x0.88 | **1.57** |
| commando | 320 | 20.7 | %7 | 288sn | x1.12 | 0.47 |
| at_team | 170 | 4.1 | %24 | 259sn | **x1.82** | 0.47 |
| tank_destroyer | 420 | 9.1 | %20 | 210sn | **x2.4** | 0.48 |

**Geri alınan iddia:** "IFV 57sn ömürle ordunun en büyük deliği" — o sayı çeşitlilik-zorlamalı
kurgudan geliyordu. Gerçek orduda IFV sağlıklı (228sn, 23 atış, x0.42, tam-yükle ölüm %0).

**Geri alınan ikinci iddia:** "infantry ve commando HİÇ ateş etmiyor" — `ATIŞ` sütunu mühimmat
azalmasından sayılıyordu, ikisinin de mühimmatı SINIRSIZ (`ammo: null`). Sayaç `lastAttackTime`
değişimine bağlandı: infantry 13.8, commando 20.7 atış. SAM'deki "0 atış" hatasının aynı sınıfı,
üçüncü tekrarı — bu yüzden sayaç kalıcı olarak düzeltildi.

**Gerçek hedef: DOLAYLI ATEŞ EKONOMİSİ.** Topçu hedefinin %82'sinde hedefi varken 11 atış yapıp
x0.21 getiriyor; havan x0.15. Birlikte 810₺ ordunun en pahalı verimsizliği. Karşılaştırma:
tank_destroyer x2.4, at_team x1.82 (yani sorun "AI ateş etmiyor" değil, **atışın karşılığı yok**).

**scout_vehicle için not:** getiri x0 beklenen — keşif biriminin işi imha değil görüş. Bu birim
`getiri` lensiyle değerlendirilemez; ayrı bir görüş-katkısı metriği gerekir (açık madde).

### Yeni araç

`tools/birim-oncu-teshis.js --birim <id>` — herhangi bir birim için ölüm anı ve ömür boyu:
kütle merkezine göre işaretli derinlik, **yerel dost/düşman oranı** (600px), en yakın düşman,
atış/hedefli oranı, öldüren tipler. "Erken ölüyor" şikâyetlerinde ilk başvurulacak araç.

---

## 27. BİRİM ÖDÜL DEFTERİ — tek-lens hatasının kökü

**Kullanıcı:** *"hataya düşme nedenimiz ödül sorunuydu. Her birimin kendi ödül mekanizması olmalı,
çünkü her birimin görevi farklı — topçu hasar veya panik yarattıkça ödül almalı, istihkâm ne kadar
birimi siperde tutarsa veya helo yakıt ikmali aldıysa ödül almalı."*

Bu teşhis doğru ve bu oturumdaki hataların **ortak kökü**. Tek bir `getiri` (imha değeri ÷ maliyet)
lensi kullandım ve üç kez yanlış hedef gösterdi:
- topçu x0.21 → "ordunun en pahalı verimsizliği" sandım
- keşif x0 → "hiçbir işe yaramıyor" göründü
- IFV x0.05 → daha önce ölçülmüştü; **orduDAN ÇIKARINCA sonuç kötüleşti** (35/48 → 29-34/48)

### Mekanizma (`BATTLE_CREDIT`, `globals.js`)

Maç boyunca her birime **kendi işini** yazan deterministik defter. Sim durumuna dokunmaz, RNG
kullanmaz, varsayılan KAPALI. Bağlandığı yerler:
- `applyDirectHit` → hasar / panik / baskı / imhaDeger **atışı yapana**, emilen hedefe
- `applyTankSplash` + **`applyBlast`** → alan hasarı da aynı şekilde. *(İlk sürümde yalnız doğrudan
  vuruş bağlanmıştı ve topçu 0 hasar/0 panik görünüyordu — dolaylı ateş ayrı yoldan geçiyor.)*
- siper `builderId` → kurduğu siperde geçen **dost-saniye** istihkâma
- `REFUEL_DOCK` → kurduğu üste yapılan **helo dolumu** istihkâma
- görüş payı → bir düşmanı gören her dost **1/N** pay alır *(ilk sürüm "yalnız o gördü" idi;
  16 birimlik orduda hiç gerçekleşmiyor, tüm birimler 0.00 veriyordu)*

### İlk tablo (3 tohum, AI doğal ordusu, birim başına ve maliyete bölünmüş)

| birim | ₺ | imha/₺ | hasar/₺ | PANİK | **BASKI** | EMİLEN | siper | dolum | GÖRÜŞ |
|---|---|---|---|---|---|---|---|---|---|
| tank_destroyer | 420 | **2.46** | 2.40 | 260.7 | 29.8 | 0.47 | 0 | — | 0.25 |
| at_team | 170 | 1.50 | 1.63 | 168.0 | 36.0 | 0.53 | 0 | — | 0.62 |
| spaag | 300 | 1.00 | 1.23 | 202.5 | 283.3 | 0.38 | 0 | — | 0.45 |
| engineer | 200 | 0.63 | 0.21 | 27.1 | 115.0 | 0.38 | 0.5 | **39.3** | 0.68 |
| manpads_team | 190 | 0.47 | 0.30 | **286.9** | 7.9 | 0.10 | 0 | — | 0.72 |
| infantry | 100 | 0.41 | 0.61 | 76.3 | 174.2 | **1.86** | 0 | — | **1.01** |
| **artillery** | 450 | **0.36** | 1.54 | 89.0 | **415.6** | 0.47 | 0 | — | 0.21 |
| mortar_team | 180 | 0.30 | 0.48 | 24.3 | 177.8 | 0.82 | 0 | — | 0.26 |
| scout_vehicle | 180 | 0.00 | 0.03 | 1.1 | 13.9 | 0.97 | 0 | — | 0.52 |

**Okuma:** topçu ordunun **baskı üreteci** (415.6, spaag'ın 1.5 katı) — imha sütunuyla yargılanamaz.
Infantry ne öldürür ne vurur; **perde (1.86) ve göz (1.01)**. Tank avcısının x2.46'sı büyük
ihtimalle o baskının üstüne biniyor — yani kullanıcının hipotezi ("topçu panik yaratmasa tank
avcıları daha erken ölürdü") defterle tutarlı. Nedensellik ayrıca test edilmeli (çıkar-ve-bak).

### Açık maddeler

- **Metrik yanlılığı:** GÖRÜŞ ve EMİLEN maliyete bölündüğü için UCUZ ve KALABALIK birimleri
  kayırıyor (infantry 100₺ × 6). Karar verirken sütunlar arası kıyas değil, **aynı sütunda
  birim-içi kıyas** yapılmalı.
- Kalan ödül kanalları (25 birim için): SAM/manpads **hava caydırma** (düşmanın menzilde geçirdiği
  süre), ew_vehicle **jam-tik**, medic **iyileştirilen HP**, supply_truck **teslim edilen mühimmat
  + önlenen kuru-süre**, transport_helo **teslim edilen yolcu × kazandırılan mesafe**,
  drone_operator **salınan drone hasarı**, command_vehicle **hale kapsaması × rally**.
- Bu defter aynı zamanda **beonai'nin kredi-atama girdisidir**: "kim kazandırdı" sorusu tek sayıyla
  cevaplanamaz; miyop oracle'ın yerine geçecek ödül şekillendirmesi buradan beslenecek.

### 27b. Ödül kanalları TAMAMLANDI — 20 kanal, her birim kendi işinde

Kullanıcı: *"baskı/emilen/görüş/imha/dolum üzerine başka tip ödüller de ekle ki birimler özelleşsin;
beonai'nin ihtiyaç duyduğu şey başından beri ödül sorunuymuş. Kalan birlikleri tek tek ödüle bağla."*

**Eklenen kanallar (motor bağlantılı):** `iyilestirme` + `kurtarma` (sağlıkçı — ölüm eşiğinden
çıkarma), `muhimmat` + `kuruEngel` (ikmal — kuru birimi tekrar atar hale getirme), `jamTik` (EH),
`haleTik` + `rally` (komuta), `tasinan` + `tasimaMesafe` (nakliye helo), `mayin` (istihkâm),
`droneHasar` (operatör — **çocuğunun** hasarı ona da yazılır), `tespit` (ilk tespit payı),
`havaCaydirma` (düşman uçağının AA menzilinde geçirdiği süre).

**ÜÇ AYRI HASAR YOLU** — bu, defterin en önemli tuzağıydı ve iki kez yakalandı:
`applyDirectHit` (doğrudan), `applyTankSplash` + `applyBlast` (alan), ve **Unit.js'teki KAMİKAZE
IMPACT** bloğu. Yalnız birincisini bağlamak topçuyu 0 hasar/0 panik gösterdi; üçüncüsünü bağlamamak
sarf-drone'u 11 kez fırlatılıp 0 hasar yazar hâlde bıraktı. **Yeni bir kredi kanalı eklerken önce
"bu hasar hangi yoldan geçiyor" sorulmalı.**

### Uzmanlık haritası (kanal-içi z-skoru, 3 tohum, AI doğal ordusu)

| birim | 1. kanal | 2. kanal |
|---|---|---|
| drone_operator | **droneHasar (z+4.0)** | imha/₺ (z+3.2) |
| engineer | **mayın / siper / dolum (z+4.0)** | — |
| supply_truck | **mühimmat / kuruEngel (z+4.0)** | — |
| medic | **kurtarma (z+3.9)** | iyileştirme (z+1.8) |
| **artillery** | **BASKI (z+2.8)** | hasar/₺ (z+1.1) |
| infantry | **emilen (z+2.7)** | GÖRÜŞ (z+2.2) |
| tank_destroyer | hasar/₺ (z+2.3) | imha/₺ (z+1.6) |
| manpads_team | PANİK (z+2.3) | GÖRÜŞ (z+1.0) |
| spaag | BASKI (z+1.7) | PANİK (z+1.3) |
| mbt | emilen (z+1.1) | hasar/₺ (z+0.3) |
| at_team | hasar/₺ (z+1.2) | PANİK (z+0.9) |
| ifv | hasar/₺ (z+1.0) | emilen (z+0.8) |
| mortar_team | BASKI (z+0.8) | emilen (z+0.5) |
| **scout_vehicle** | **emilen (z+1.3)** ← keşif birimi, ürünü hasar yemek | GÖRÜŞ (z+0.2) |
| **recon_uav** | **GÖRÜŞ (z+0.4)** ← keşif İHA'sı görüşte lider bile değil | tespit (z+0.1) |
| **commando** | **tespit (z+0.3)** ← 320₺, hiçbir kanalda öne çıkmıyor | imha/₺ (z+0.2) |

**Doğrulanan kullanıcı hipotezi:** *"topçu atışları panik yaratmasa belki tank avcıları daha erken
ölecek"* — topçu BASKI'da z+2.8 ile açık ara lider; imha sütunuyla yargılanamaz. Nedensellik
(çıkar-ve-bak) ayrıca test edilecek.

**Sıradaki derin teşhis hedefleri (artık doğru lensle):** scout_vehicle ve recon_uav — iki adanmış
keşif birimi de GÖRÜŞ kanalında lider değil; lider 100₺'lik piyade (z+2.2). Ve commando: 320₺ ile
hiçbir kanalda uzmanlık göstermiyor.

**Doğrulanan sıfır:** HAVA (caydırma) sütunu boş çıktı — ölçüm hatası DEĞİL: düşmanın yalnız 1 hava
birimi var ve kırmızının AA menziline hiç girmiyor. Yani manpads'in bu maçlarda gerçekten işi yok.

---

## 28. GECE KOŞUSU + ÖDÜL SİNYALİ — değer fonksiyonu kapıyı geçti, ama oracle ATILMIYOR

### Gece koşusu (2026-08-06 → 07)

9 işçi, ~8.6 saat, **14.876 maç / 813.712 anlık görüntü / 3.25 GB**. Hedef 33.700 maçtı; makine
gece birkaç saat **uyudu** (RAM kaydının 15 dakikalık aralığı 238 → 437 → 509. dakikaya atladı —
`setInterval` uykuda tetiklenmez). Uyanınca hız normale döndü (1.09 maç/sn).

**İki çökme, aynı kök neden (senkron döngüde tamponlu yazma):**
1. `durum-veri.js` `createWriteStream` kullanıyordu → olay döngüsü hiç çalışamadığı için **tek satır
   bile diske düşmüyordu**; veri bellekte birikiyordu. Geçmişteki gece koşusunun 0.17 maç/sn'ye
   düşmesinin sebebi de buydu. → maç başına tek `fs.writeSync`.
2. Orkestratörün **birleştirme adımı** 9 dosyayı senkron döngüde belleğe okuyup akışa yazıyordu →
   3.2 GB tampon → süreç öldü (dosya tam 4 GB = 2³²'de dondu). → birleştirme tamamen kaldırıldı,
   eğitim 9 dosyayı doğrudan okuyor.

**Kullanıcı kararı:** %95 erken bitiş (bir tarafın kalan değer payı eşiği aşınca maç kesilir).
Maçlar 7300 yerine 2100-3700 tikte bitiyor.

**İşçi sayısı RAM'e göre seçilir, çekirdeğe göre değil:** işçi başına 456 MB; 12 işçi 1.44 maç/sn
ama boş RAM 0.79 GB (sayfalama riski), **9 işçi 1.17 maç/sn ve 2.26 GB boş** ← seçildi.

### Değer fonksiyonu — KAPI GEÇTİ

| | kapı | sonuç |
|---|---|---|
| Spearman ρ | ≥ 0.45 | **0.830** |
| kazanan ayrımı | ≥ %70 | **%86** |

Maç-bazlı bölme (11.900 eğitim / 2.976 test maçı). Zamana göre: 0-30sn ρ 0.397 · 30-70sn 0.629 ·
70-120sn 0.858 · 120-200sn 0.942 · 200sn+ 0.973. *(Geç bantlardaki yükseklik kısmen bedavadır —
maç zaten bitmek üzeredir; anlamlı olan erken bantlardır.)*

### Ödül karşılaştırması — "yeni olan daha iyidir" YİNE yanlış çıktı

`tools/odul-karsilastir.py`, ayrılmış test maçlarında, oracle'ın kendi penceresiyle (30sn):

| hedef | oracle | ΔV |
|---|---|---|
| (A) nihai marj `y` | **0.808** | 0.310 |
| (B) artık `y − V(t)` | 0.315 | **0.546** |
| (C) artık `y − kuvvetFarkı(t)` — **model-bağımsız** | 0.363 | **0.447** |

**(A)'yı oracle'ın kazanması yanıltıcıdır:** skalarında `forceLead` var, yani "zaten öndeyim"
bilgisi — kararın kattığı değer değil, konumun kendisi. Doğru hedef artık sonuçtur. (B)'nin tabanı
`V(t)`'nin kendisi olduğu için ΔV lehine yanlı olabilir; bu yüzden **(C)** model-bağımsız tabanla
eklendi ve karar ona göre verildi.

**Bant başına:** oracle 30-120sn arasında daha iyi (0.615 / 0.596), ΔV 120sn sonrasında daha iyi ve
**200sn+ bandında oracle NEGATİFE düşüyor (−0.191)** — yani maç sonunda aktif olarak yanlış
yönlendiriyor. Miyop teşhisinin en somut hâli budur.

### KARAR: zamana göre ağırlıklı KARIŞIM (oracle atılmıyor)

`karisim = w·ΔV + (1−w)·oracle` (ikisi de z-skorlanır). Tarama sonucu:

| | genel ρ |
|---|---|
| yalnız oracle (w=0) | 0.363 |
| yalnız ΔV (w=1) | 0.447 |
| **w=0.7 (en iyi sabit)** | **0.463** |

Bant başına en iyi ağırlık **zamanla düzenli artıyor** — fiziksel olarak anlamlı (erken oyunda takas
somut/V belirsiz, geç oyunda V sonucu bilir/takas gürültü):

| an | en iyi w | karışım ρ | oracle tek başına |
|---|---|---|---|
| 0-30sn | 0.4 | 0.501 | 0.454 |
| 30-70sn | 0.3 | 0.643 | 0.615 |
| 70-120sn | 0.4 | 0.641 | 0.596 |
| 120-200sn | 0.7 | 0.436 | 0.332 |
| 200sn+ | 1.0 | 0.326 | **−0.191** |

Karışım **her bantta** oracle'ı geçiyor ve son bantta işaretin yönünü düzeltiyor.

### Sıradaki adım

beonai'nin etiketleme hattı (`tools/beonai-uret.js`) aday yuvarlamalarının **başında ve sonunda**
durum öznitelikleri (raster + skaler) dökecek; ödül çevrimdışı Python'da bu karışımla hesaplanacak.
Değer ağı yalnız **etiketleme** için gerekli, oyun anında değil → JS'e model taşımaya gerek yok,
determinizm riski yok.

---

## 29. BEONAI MAÇ KAPISI ve TAVAN — "veri mi az, yoksa kazanılacak şey mi az?"

### Yapılanlar

`js/BattleStateFeatures.js` (paylaşılan öznitelik çıkarımı — eski satır-içi sürümle **byte-birebir**
aynı olduğu kanıtlandı), oracle'a yuvarlama-sonu durum yakalama, `tools/beonai-odul.py` (ödül =
zamana göre ağırlıklı `w·ΔV + (1−w)·oracle`), `tools/beonai-mac-kapisi.js` (eşleştirilmiş fark,
taraf-başı, bağlanma kanıtı, determinizm kontrolü).

**Üretim:** 179 maç, 2.544 karar → 1.761 ödül-hesaplanabilir karar. Karışım, kararların **%48'inde**
oracle'dan FARKLI bir adayı en iyi buluyor (etiket değişimi gerçek).

**Eğitim (dev):** karışım top1 %4.9 / oracle-etiketi %2.3 — karışım modeli en iyi adayı iki kat sık
buluyor.

### MAÇ KAPISI (48 eşleştirilmiş maç, eğitimde KULLANILMAYAN tohumlar)

| kol | eşl. fark | std.hata | t | galibiyet | McNemar |
|---|---|---|---|---|---|
| **ORACLE (mükemmel seçici)** | **+771** | 430 | **1.80** | 20→25 / 48 | — |
| beonai karışım | +350 | 490 | 0.71 | 20→26 / 48 | χ² 1.25 anlamsız |
| beonai oracle-etiketi | +305 | 493 | 0.62 | 20→23 / 48 | χ² 0.19 anlamsız |

### SONUÇ: TAVAN DÜŞÜK — beonai kötü öğrenmiyor

Her karar noktasında 64 adayı GERÇEKTEN yuvarlayıp en iyisini oynayan **mükemmel seçici** bile
yalnız +771 kazanıyor ve bu bile anlamlılığa ulaşmıyor. beonai tavanın ~yarısını (+350/+771) zaten
alıyor. Yani daha fazla veri toplamak en iyi ihtimalle +350'yi +771'e taşır — o da gürültüde kalır.

**Kullanıcı bunu önceden gördü:** *"o kadar maç yaptık, GB'larca veri biriktirdik, bunların hiçbiri
işe yaramadıysa (c)'yi öncelikli tutmak şart."* Doğru öncelik buydu; tavan ölçümü veri toplamadan
ÖNCE yapılmalıydı.

### ÇEKİNCE: bu tavan KOŞULLU

Oracle kendi **miyop** hedefini mükemmel optimize ediyor (12sn'lik yuvarlamadaki takas farkı).
Yani ölçülen şey "mükemmel oyunun tavanı" değil, **"miyop hedefi mükemmel optimize etmenin
tavanı"**. Aynı gün bu hedefin geç oyunda NEGATİFE düştüğünü ölçmüştük (−0.191).
→ Ufuk 40sn'ye çıkarılıp tavan yeniden ölçülüyor: yükselirse bağlayıcı kısıt MİYOPLUK (V-güdümü
işe yarar), yükselmezse KARAR UZAYI dar (yön değişikliği gerekir — örneğin gramerin daha ayrık,
daha cesur adaylar üretmesi).

### Yan ürün: üç gerçek motor hatası

Gecenin asıl kazancı değer fonksiyonu (ρ 0.830) ve bu ölçüm aygıtı oldu. Yol boyunca çıkanlar:
ferry titremesi (ayırma fiziği `loaded` yolcuyu elemiyordu), **fork'un yüklü taşıyıcıda çökmesi**
(`cargo`/`carrier` dairesel referansı — ferry düzeltmesi uyandırdı), ve gece koşusunun **diske hiç
yazmaması** (senkron döngüde tamponlu akış).

### 29b. UFUK BAĞLAYICI KISIT DEĞİL — ve "uzayı büyütmek" sayı büyütmek değildir

**Ölçüldü (aynı 24 tohum × 2 rol, ORACLE = mükemmel seçici):**

| yuvarlama ufku | eşl. fark | t |
|---|---|---|
| 12sn | +771 | 1.80 |
| **40sn** | **+662** | 1.22 |

Ufuk 3.3× uzatıldı, tavan **yükselmedi**. Bu, "oracle miyop hedefini optimize ediyor, gerçek tavan
daha yüksek olabilir" çekincesini ÇÜRÜTÜR. Sorun hedefin kısalığı değil: **adayların hepsi benzer
sonuca götürüyor.**

### Kullanıcı içgörüsü: "uzayı 10 kat büyütmek için sayıları büyütmek yetmiyor gibi"

Doğru ve kendi verimiz kanıtlıyor: **tempo ve allocation'ın İKİSİNİN DE 3 seçeneği vardı**, ama
allocation varyansın %34.4'ünü, tempo %2.7'sini açıkladı — **aynı sayı, 12× farklı etki**. Fark
seçenek sayısında değil, seçeneğin bağlı olduğu MEKANİZMADA: allocation gerçekten kuvvet dağıtıyor,
tempo yalnız bir takip mesafesi değiştiriyordu.

→ **Kural:** aday sayısını 64'ten 640'a çıkarmak uzayı büyütmez, yalnız maliyeti 10× artırır
(her aday = bir yuvarlama). Uzayı büyüten üç şey:
1. **Düğmeyi daha çok mekanizmaya bağlamak** (tempo → abort eşikleri; yapıldı).
2. **Kanıtlanmış mekanizmaları karar değişkenine çevirmek** — sektör-komuta, operasyonel duruş,
   standoff bu oturumda maçı değiştirdi ama hepsi GLOBAL BAYRAK, duruma göre seçilen şey değil.
3. **Bir kat aşağı inmek: birim görevlendirmesi.** Plan "kuvvetin %55'i ana sektöre" diyor ama
   HANGİ birimler olduğunu söylemiyor. Ödül defteri her birimin işinin farklı olduğunu gösterdi
   (topçu baskı, piyade perde+göz, tank avcısı imha) — kullanılmamış en büyük menzil burada.

**Ayrıca bulundu — asıl darlık ŞEMADAYDI:** `allocationBounds` main ≤ 0.70, reserve ≥ 0.10,
fixing ≤ 0.35 diyordu. Yani "her şeyi ana eksene ver" ve "yedek tutma" **tanım gereği yasaktı**;
en çok iş gören knob (varyansın %34'ü) en dar kutuya hapsedilmişti. v2'de kutu genişletildi.

---

## 30. FAZ 0 — beonai blob teşhisi ÇÜRÜTÜLDÜ, gerçek sebep DAĞILIM KAYMASI

Kullanıcı dört AI'ya karşı canlı oynadı; beonai 240px yumağa büzülüp 87.6 baskıyla eridi. Bundan
"beonai blob yapmayı öğrendi" sonucunu çıkardım. **FAZ 0 bunu çürüttü.**

### 0.1 — beonai headless'ta blob YAPMIYOR (24 maç, 12 tohum × 2 rol)

| kol | yayılım | 600px yoğunluk | öz baskı |
|---|---|---|---|
| kod-AI (taban) | 775px | 11.2 | 5.5 |
| ORACLE (mükemmel seçici) | 797px | 10.5 | 4.1 |
| **beonai** | **823px** | 10.5 | **3.7** |

AI rakibe karşı beonai kod-AI'dan **daha yayılı** ve **daha az bastırılmış**. Canlı maçtaki blob
beonai'nin öğrendiği bir davranış değil.

### 0.4 — ANA BULGU: eğitim ve oyun farklı dünyalarda

| ölçü | sonuç |
|---|---|
| tam-bilgi ↔ perception arasında **farklı aday seçimi** | **%79** (92 kararın 73'ü) |
| aday listesi bile farklı | %33 |

Model **tam bilgiyle** eğitildi (`battleOracleGrammarContext` → `SIM.units`, confidence 1), canlı
maçta **perception** ile oynuyor (`observation.contacts`). Kodun kendi notu bunu "hafif kayma"
diye geçiştirmiş (`js/BattleOracle.js:82-83`); ölçülünce hafif değil.

Canlı maçta beonai'nin baskısı 87.6 iken aynı oyuncuya karşı intel4-pro 34.7'de kaldı — yani
beonai insan karşısında kendini fazla açtı. Eğitim verisi **tamamen AI-vs-AI**; insanın
ateş-merkezli oyunu (ölçülmüş oyuncu profili) o dağılımın dışında.

### 0.3 — ÇÜRÜTÜLDÜ: enjekte planın hedefleri zaten ayrık

| kol | gruplar arası ort. mesafe |
|---|---|
| kod-AI | 569-607px |
| **ENJEKTE** | **710-717px** |

"MAIN ve FIXING aynı `inj.point`'i paylaşıyor" hipotezi yanlış — enjekte plan kod-AI'dan daha
ayrık hedefler veriyor. Plan maddesi 1b düştü.

### 0.2 — DOĞRULANDI ama ikincil: kanat manevrası kendini iptal ediyor

Saldıran olarak FLANK grubunun sektör odağını kaybedip **global yığına** düşme oranı:
**beonai %55, kod-AI %20.** Sebep zincirin iki ucunda:
- `OperationGrammar`: `flankSector` = ana sektörün komşuları arasından **en AZ düşman olanı**.
- `js/BattleExecution.js:981-993`: o sektörde görünür düşman yoksa `focusBySector[sector]` null →
  grup **global ortak hedefe** döner. Anti-blob dalı yalnız `role === DEFENDER` için açık.

Yani kanat, boş olduğu için seçiliyor; boş olduğu için de oraya gidilmiyor. Gerçek bir kusur ama
AI rakibe karşı blob üretmiyor — önceliği ikinci sıraya düşer.

**Ayrıca:** `RESERVE` ve `FIRE_SUPPORT` sözleşmelerinde sektör hiç yok (%100) — bugünkü sektör
etiketi düzeltmesi yalnız MAIN/FIXING/FLANK'i kapsıyor.

### Yön değişikliği

Öncelik artık ödül terimleri değil **eğitim/oyun dağılım uyumu**: öğretmen (oracle) tam bilgi
kullanmaya devam etsin, ama modele verilen ÖZNİTELİKLER perception'dan üretilsin. Aksi hâlde ödül
ne kadar düzeltilirse düzeltilsin model oynadığı dünyayı görmüyor.
