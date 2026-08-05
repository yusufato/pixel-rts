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
