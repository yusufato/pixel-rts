# MUTLAK MEKANİZMA — PLAN

> Kullanıcı: *"mutlak mekanizma yaratırsak AI en kötü birimlerle bile çok yüksek performans
> sergiler. Ancak MUTLAK derken neyi söylediğimiz çok önemli: bir birlik kümesinin mutlağı,
> bir birliğin mutlağı, düşman tarafın onlarca tahmini hareketi gibi."*

Bu belge önce **mutlak**'ı tanımlar, sonra ölçülmüş gerçeklerle nereye kadar gidilebileceğini
söyler, sonra aşamalı planı verir. Her aşamanın bir **kapısı** vardır — geçemezse sonraki
aşamaya geçilmez.

---

## 0. "MUTLAK" NE DEMEK — dört ayrı şey

| seviye | soru | kombinatorik |
|---|---|---|
| **S1 — birim** | Bu birimin her hamlesi, her düşman cevabına karşı ne getirir? | eylem × cevap |
| **S2 — küme** | Şu 3 birim BİRLİKTE ne yapmalı? | eylem^birim |
| **S3 — ordu** | 25 birimin ortak planı ne? | eylem^25 |
| **S4 — derinlik** | Sonra ne olacak? (git → sonra vur → sonra çekil) | (eylem×cevap)^derinlik |

**S3 ve S4 imkânsız.** 25 birim × 25 aday = 25²⁵ ≈ 10³⁵. Bu bir mühendislik sorunu değil,
kombinatoryal duvar. Satrançta da Go'da da kimse mutlak bilgiye ulaşmadı; AlphaGo tahtanın
tamamını görmüyordu, **nereye bakacağını** biliyordu.

### Ulaşılabilir tanım: BASKINLIK

Mutlaklık yerine ölçülebilir bir hedef koyuyoruz:

> Bir karar **baskındır** (dominant) eğer seçilen eylem, denenen TÜM düşman cevaplarına
> karşı diğer tüm adayları geçiyorsa VE ikinciyle arasındaki fark gürültü tabanının
> üstündeyse.

Bu tanımın iki iyi özelliği var:
- **Ölçülebilir.** "Kararların %X'i baskın" diye raporlanır. Bugün ölçmüyoruz — ölçmeliyiz.
- **Yeterli.** Baskın bir karar, mutlak bilgiyle de aynı seçim olurdu. Kalan belirsizlik
  sonucu değiştirmiyorsa bilinmesi gerekmez.

**Hedef:** baskın karar oranını yükseltmek. Bu, "her şeyi bil"den çok daha ucuz ve aynı işi görür.

---

## 1. BUGÜN NEREDEYİZ (ölçülmüş)

### Altyapı — KURULU
| parça | durum | kanıt |
|---|---|---|
| ileri model (fork+rollout) | ✅ | `tools/ileri-model-kapisi.js` 27/27 birebir |
| değer ağı (nihai marj) | ✅ | ρ 0.864, işaret %89 (`tools/deger-agi-kapisi.js`) |
| analitik ön eleme | ✅ | K=3'te kazancın %72'si, bedava |
| ölçüm tezgâhları | ✅ | rol-dengesi · gelecek-yelpazesi · hedef-kararliligi |

### Arama — S1'in bir parçası
```
25 aday (8 yön × 3 halka + kal)  →  analitik ilk 3  →  3 düşman tepkisi  →  en kötü durum
5 birim / 5 saniye · çift yönlü sıra · yayılım kapısı (%27 atlıyor)
```

### Ölçülmüş maliyetler
| işlem | süre |
|---|---:|
| fork / restore | 2.1 / 2.4 ms |
| rollout 5sn | 106 ms |
| rollout 10sn | 203 ms |
| değer ağı tahmini | ~1 ms |
| 80sn oyun, tam arama | 121 sn (2.7× rakip modeliyle) |

### Maç sonucu — HİÇBİRİ KANITLANMADI
| kol | marj | t |
|---|---:|---:|
| 1 birim, kör | +191 | 0.55 |
| 5 birim, kör | −12 | −0.03 |
| 5 birim, sıralı | −12 | −0.03 |
| 5 birim, **değer ağı** | **+291** | 0.79 |
| 5 birim, + rakip modeli | +272 | 0.68 |
| **YIĞIN — 20 birim, ağ sıralama+kapı, tek geçiş** | **+1369** | **3.15 ✅** |

**KAPSAM BAĞLAYICI KISITTI.** Beş kol boyunca ordunun yalnız %4-20'si arama kullanıyordu ve
hiçbiri gürültü tabanını aşmadı. 20 birime çıkınca etki **anlamlı** hale geldi (n=48, t 3.15,
saptama tabanı ±1218) ve saldıran dezavantajı TERSİNE DÖNDÜ:

```
LA kapalı        saldıran %41.7   marj −523
YIĞIN            saldıran %62.5   marj +846
```

Bütçe iki ÖLÇÜLMÜŞ NEGATİFTEN geldi: çift yönlü sıra (2×, no-op) ve rakip modeli
(2.7×, kazanç yok) kapatıldı, o bütçe kapsama aktarıldı. Yani negatif sonuçlar
boşa gitmedi — birikip pozitifi finanse ettiler.

### Öğrenilen üç ders
1. **Hedef kararlıydı sanılıyordu, değildi.** `argmax(marj@10sn)` 20sn'de kazancın %13'ünü
   koruyor. Beş null sonucun tek açıklaması buydu. Değer ağı bunu çözmek için var — hız için değil.
2. **Elle yazılan ölçü yetmiyor.** Sekiz aday (fırsat/maruziyet/can/yerel oran…) denendi,
   hiçbiri global marjı geçemedi, ikisi negatif çıktı.
3. **Değişiklik yapmadan önce çeşitlendirmeyi doğrula.** Çift yönlü sıra 3.5 kat maliyetle
   hiçbir şey değiştirmedi (planların %90'ı aynıydı). Rakip modellemesinde bu adım önce
   yapıldı: yayılım 94 → maliyet karşılığını buluyor.

---

## 2. EKSİK OLANLAR — beş eksen

| eksen | bugün | mutlağa doğru |
|---|---|---|
| **eylem türü** | sadece "şu noktaya git" | + hedef seçimi, yetenek (mayın/üs/drone), çekilme, yön |
| **kapsam** | 5 birim / 25 | tüm ordu |
| **küme kararı** | birimler bağımsız | yakın birimler BİRLİKTE |
| **düşman** | 3 tepki (karar-anı kayması) | onlarca tepki, farklı mekanizmalarla |
| **derinlik** | 1 hamle | hamle dizisi |

---

## 3. PLAN — altı aşama, her biri kapılı

Sıralama **ölçülmüş kaldıraca** göre; ucuz ve büyük çarpanlar önce.

### A1 — Rollout'u değer ağıyla DEĞİŞTİR (en büyük çarpan, en ucuz)
**Bugün:** 25 aday analitik puanlanıp 3'ü **oynatılıyor** (3 × 106ms).
**Öneri:** 25 adayın hepsi **doğrudan değer ağıyla** puanlansın — birimi aday noktaya
*taşıyıp* durumu ağa sorarak, rollout YAPMADAN. ~1ms × 25 = 25ms.
Sonra yalnız ilk 2-3 aday gerçekten oynatılsın (doğrulama için).

> **Neden büyük:** maliyet 318ms → ~50ms, yani **6 kat**. Bu tek başına "5 birim"i
> "tüm ordu"ya çevirir. Değer ağı zaten pozisyondan tahmin ediyor; rollout'u ondan önce
> koymak için bir sebebimiz yok.

**KAPI:** ağ-ile-doğrudan seçim, rollout'lu seçimle aynı adayı ne sıklıkla seçiyor?
`tools/gelecek-yelpazesi.js` yöntemiyle ölçülür. **≥%70 örtüşme** → geç.

#### ⛔ A1 ÖLÇÜLDÜ — KAPIYI GEÇMEDİ (2026-08-17, 3 tohum / 26 ölçüm / 23.8 aday)

| eleme kuralı | K=3 | K=4 | K=6 | K=8 |
|---|---:|---:|---:|---:|
| 1sn rollout | %26 | %35 | %68 | %78 |
| ANALİTİK (bedava) | %45 | %67 | %72 | %73 |
| **AĞ-DOĞRUDAN** | **%50** | %61 | **%77** | **%79** |

Ağ-doğrudan, analitik skorla **aynı sınıfta** — K=3'te biraz iyi (50 vs 45), K=4'te
biraz kötü (61 vs 67). Yani rollout'u ELEYECEK kadar isabetli değil: ilk 3'e inince
kazancın yarısı gidiyor, %70+ için hâlâ 6-8 rollout gerekiyor.

**Maliyet hesabı çöküyor:**
```
bugün : 25 analitik (bedava) + 3 rollout          = 318 ms
A1 ile: 25 ağ (25 ms)        + 6 rollout (%77)    = 661 ms   ← DAHA PAHALI
```

**Neden:** ışınlama yaklaşıklığı. Ağ birimi hedefte *hazır* görüyor; 5 saniyede
yürümesini, yolda maruz kalacaklarını ve düşmanın o sırada yaptıklarını görmüyor.
Ağın eğitildiği şey "bu durumdan sonuç ne" — "bu noktaya gidersem ne olur" değil.

**KALAN DEĞERİ:** analitik eleyicinin yerine geçebilir (aynı maliyet sınıfı, K=3/6/8'de
biraz daha iyi). Ama vaat edilen 6 katlık maliyet kesintisini VERMİYOR.

**A3 (kapsam) için bütçe başka yerden bulunmalı.** Üç aday:
- rollout'ları işçi ipliklerine dağıt (birbirinden bağımsızlar) — ölçülmedi
- ağ-doğrudan skorla BİRİMİ ATLA: hiçbir aday "yerinde kal"ı belirgin geçmiyorsa o
  birim için hiç rollout yapma (bugünkü analitik yayılım kapısının ağ sürümü)
- ufku 5sn'den kısalt — ama kısa ufuk gürültülü, ölçüldü

### A2 — Baskınlık ölçümü (ölçüm borcu)
Her kararda: seçilen aday, tüm düşman cevaplarına karşı kazandı mı? İkinciyle farkı ne?
`BATTLE_LA_SAYAC`'a eklenir. Maliyeti sıfır.

**KAPI:** yok — bu bir gösterge. Ama bundan sonraki her aşama bu oranı **yükseltmeli**,
yoksa aşama işe yaramamıştır. Marj yerine buna bakmak, ±1000'lik gürültü tabanını atlatır.

### A3 — Kapsamı tüm orduya çıkar
A1'den sonra bütçe var. 5 → 20 birim.
**Beklenen:** etki ~4 kat büyür → n=48'de bile görünür hale gelir.

**KAPI:** `rol-dengesi` 48 tohum. Marj farkı **+400 üstü** ya da baskınlık oranı belirgin artış.

### A4 — Küme kararı (S2)
Yakın birimleri (≤700px) küme yap, küme içinde **ortak** ara: 3 birimin 3'er adayı = 27
kombinasyon, hepsi ağla puanlanır (27ms). Kümeler arası bağımsız.

> **Neden 5sn'de işe yaramadı, kümede yarayabilir:** sıralı taahhüt ölçüldü ve no-op çıktı
> çünkü birimler birbirinin bölgesine ulaşmıyordu. Küme tanımı bunu düzeltir — zaten
> etkileşen birimler birlikte ele alınır.

**KAPI:** küme içi ortak seçim, bağımsız seçimden farklı mı? Fark %20'nin altındaysa
küme mekaniği gereksiz — kapat.

### A5 — Eylem uzayını genişlet
Sırayla: **hedef seçimi** (kime ateş), **çekilme anı**, **yetenek** (mayın alanı, üs, drone).
Her biri ayrı ölçülür; yetenekler seyrek karar olduğu için arama maliyeti düşük.

> **Uyarı:** yetenek katmanı daha önce ölçüldü ve doğal orduda kazanç SIFIR çıkmıştı —
> sebebi AI'nın o birimleri hiç satın almaması. Yani buraya girmeden önce **satın alma**
> tarafına bakılmalı, yoksa aynı duvara çarpılır.

**KAPI:** her eylem türü için ayrı `rol-dengesi` koşusu.

### A6 — Düşman modelini derinleştir
Bugün tek mekanizma var (karar-anı kayması, yayılım 94). Eklenecekler: duruş zorlama,
farklı plan türü, farklı hedef önceliği. Her yeni mekanizma için **önce yayılım ölçülür** —
sıfırsa eklenmez.

**KAPI:** yayılım > 50 marj ve baskınlık oranı düşmüyor.

---

## 4. YAPMAYACAKLARIMIZ — ve nedeni

| yapılmayacak | neden |
|---|---|
| tam ortak arama (S3) | 10³⁵ kombinasyon |
| çok adımlı derinlik (S4) | (eylem×cevap)^derinlik; A1 bitmeden anlamsız |
| düşmanın da arama yapması | özyinelemeli, üstel; önce tek seviye kanıtlanmalı |
| her değişiklikten sonra 700+ maçlık kanıt turu | 4 saat/tur. Kanıt turu ancak mekanizma dondurulunca |

---

## 5. KANIT STRATEJİSİ — ayrı bir iş

Mekanizma geliştirmek ile kanıtlamak **iki ayrı iştir**; karıştırmak zaman öldürür.

- **Geliştirirken:** ucuz göstergelere bak — baskınlık oranı, aday yayılımı, örtüşme oranı.
  Bunlar n=17-48'de bile okunur.
- **Dondurunca:** tek büyük kanıt turu. +291'i %80 güçle kanıtlamak n≈700 (≈4 saat, 8 parça).

Ara turlarda `t < 2` çıkması **başarısızlık değildir** — test gücü yetersizdir. Bunu
başarısızlıkla karıştırmamak için her raporda saptama tabanı (±) yazılır.

---

## 6. BAŞARININ TANIMI

Kullanıcının cümlesi ölçüte çevrilirse:

> *"AI en kötü birimlerle bile çok yüksek performans sergiler"*

**Ölçüt:** aynı bütçeyle kurulmuş ZAYIF orduyla (getiri sıralamasında alt yarıdan seçilmiş
birimler) arama açık AI, arama kapalı ve GÜÇLÜ ordulu AI'ya karşı **%50+** kazanmalı.

Bu, marj farkından daha zorlu ve daha anlamlı bir sınav: mekanizmanın kompozisyon
dezavantajını kapatıp kapatmadığını doğrudan söyler. `tools/rol-dengesi.js` ordu tarifini
değiştirerek bu kurguyu kurabilir.

---

## EK: ölçüm tuzakları (bu turda yaşananlar)

1. **Tekrarlanabilirlik ≠ atfedilebilirlik.** Rollout deterministikti, aynı sayıyı veriyordu —
   ama o sayı birimin katkısını değil haritanın geri kalanını ölçüyordu.
2. **Çeşitlendirmeyi doğrulamadan maliyet ödeme.** Çift yönlü sıra 3.5 kat maliyetle no-op.
3. **Tek koşudan iki farklı ölçü okuma.** Eşleştirilmiş fark kurgu hatasına dayanıklı,
   mutlak oran değil. Farkı kurtaran şey oranı kurtarmaz.
4. **Paralel hızı tek süreçte ölçme.** 8 işçi 8 kat değil 3 kat verdi.
