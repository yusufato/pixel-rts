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
