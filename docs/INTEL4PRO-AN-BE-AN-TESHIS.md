# intel4-pro — An-be-an maç teşhisi (güncel motor)

**Tezgâh:** `--matchtimeline [--seeds a,b]` — maçı **10 saniyelik kovalara** böler; taraf-başı canlı-₺, birim sayısı,
**mühimmat oranı**, boş-mühimmatlı birim sayısı, bastırma, atış/öldürme/hasar ve **ortalama angajman mesafesi**.
Veriyi `BATTLE_FORENSIC`'ten değil (2048'lik halka tampon erken evreyi düşürür) **canlı olay kancasından** toplar.

**Konfigürasyon:** intel4 vs intel4 (ayna), **6500₺ iki taraf eşit**, gerçek-oyun beyni (varsayılan deltalar + `defense`+`range`+`drone`).
**Tarih:** 2026-08-03 · motor `battlefield-v4-roster25-intel4-deferdmg-s2-posture-pdair`

> Eski belgelerdeki 1400/1600/1800/5000 bütçeli ölçümler ve o dönemin planları **geçersizdir**. Bu belge güncel motorla alınmıştır.

---

## 1. Maçlar gerçekte 2–3.5 dakikada bitiyor (360sn değil)

| tohum / rol | sonuç | ilk temas | **gerçek bitiş** |
|---|---|---|---|
| 2024 / red saldırıyor | red (attacker_dominant) | 20sn | süre doldu (360sn, 1650 vs 1620) |
| 2024 / blue saldırıyor | red | 30sn | **210sn** |
| 777 / red saldırıyor | red (defender_eliminated) | 20sn | **130sn** |
| 777 / blue saldırıyor | red | 20sn | **130sn** |

**Ölçüm sonucu:** harness tavana (7300 tik) kadar koşuyor; maç bittikten sonraki "ölü hava" toplam metrikleri kirletiyor.
Bu, daha önce raporladığım *"kayıp 4997₺/maç"* gibi toplamların neden yanıltıcı olduğunu açıklıyor.
**Kural:** bundan sonra bütün toplam metrikler **gerçek bitiş anına kadar** hesaplanmalı.

## 2. Angajman mesafesi: savunan ~900–1000, saldıran ~400

| tohum/rol | saldıran ort. | savunan ort. |
|---|---|---|
| 777 / red sld | 471 | **989** |
| 909 / red sld | 435 | **864** |
| 909 / blue sld | **906** | 551 |
| 777 / blue sld | 422 | 480 |

R1 doktrini (`range`-delta, 0.9×menzil stand-off) **savunan tarafta çalışıyor**; saldıran kapatıp yaklaşıyor — bu tasarım gereği.
→ Planın *"ort. menzil ≥900"* kabulü **global ortalamaya uygulanamaz**; yalnız stand-off yapabilen taraf/sınıf için anlamlı.

## 3. ⭐ ANA BULGU — savunanın mühimmat disiplini yok (tek felaket kaybın mekanizması)

seed777 / red saldırıyor — mavi savunan **imha edildi (t=130sn)**:

| sn | mavi ₺ | birim | **mühimmat** | boş-muh | olay | hasar | mesafe |
|---|---|---|---|---|---|---|---|
| 30 | 5850 | 21 | 0.85 | 0 | **63** | 1209 | 910 |
| 40 | 5620 | 21 | 0.74 | 0 | **83** | 919 | 912 |
| 50 | 5530 | 20 | 0.61 | 0 | **67** | 673 | 1028 |
| 60 | 5070 | 17 | 0.52 | **3** | 16 | 57 | 928 |
| 80 | 4300 | 14 | 0.49 | 4 | 5 | 402 | 384 |
| 100 | 2880 | 8 | 0.20 | 4 | 3 | 146 | 287 |
| 110 | 1640 | 5 | **−0.05** | 5 | 1 | 14 | 896 |
| 130 | **0** | 0 | — | — | 0 | 0 | 0 |

**Zincir:** savunan t=30-50'de **aşırı yüksek atış hızıyla** (63/83/67 olay — diğer maçlarda tipik 10-30) uzun menzilden ateş açıyor
→ mühimmat 0.85'ten 0.52'ye iniyor, 3 birim kuruyor → **atış hacmi 67'den 16'ya, 4× düşüyor** (ordusunun hâlâ %70'i sağ!)
→ ateş desteği kesilince yaklaşan saldırganı durduramıyor → 80 saniyede siliniyor.
Karşılaştırma: saldıranın mühimmatı aynı sürede 0.9→0.67 arasında kalıyor, 0-2 birim kuruyor, atış hacmi 10-24'te **sabit**.

**Genellik uyarısı:** bu şiddette çöküş **4 maçın 1'inde** görüldü. Diğer üçünde mühimmat 0.9→0.5-0.6 bandında yumuşak iniyor.
Yani bu bir *yasa değil*, **felaket kaybın imzası**. Ama mekanizma tutarlı ve test edilebilir.

## 4. Küçük ama gerçek kusur — NEGATİF mühimmat

217 kovanın 2'sinde ortalama mühimmat **negatif**. Sebep: mühimmat ikmalle **kesirli** olabiliyor
(`resupplyRate`), ateş kapısı `ammo <= 0` bakıyor (0.5 geçer), tüketim ise **tam 1** düşüyor → `0.5 − 1 = −0.5`.
Etkisi: kurumuş birim ikmalle 0'ın üstüne çıkmak için fazladan mühimmat bekliyor.

---

## PLAN (bu teşhise dayalı)

### P1b — KÜTLE-HEDEFLEMESİ: ÇALIŞIYOR ✅ (2026-08-04)

**Kök neden (birim-tipi kırılımı):** savunanın kuruyan birimleri **yalnızca dolaylı ateş** (topçu 1 + havan 2-3 + ÇNRA 1);
saldıranda hiç kuru birim yok. Sebep [Unit.js:1374](../js/Unit.js#L1374): `if (this.isIndirect) { sc = -d; }`
→ dolaylı ateş **en yakın** düşmana atıyor ("splash zaten alan" varsayımı) → 3-8 mermilik şarjör tek gezen keşif aracına gidiyor.

**Çözüm:** pro-delta `indirectMassing` — hedef, patlama yarıçapındaki düşman **kütlesine** göre seçilir (mermi başına değer).

**A/B (4 tohum × 2 rol = 8 maç, pro yalnız mavide):**

| | taban | pro |
|---|---|---|
| mavi toplam | **1/8** | **4/8** |
| mavi SAVUNANKEN | 1/4 | **3/4** |
| mavi SALDIRANKEN | 0/4 | **1/4** |

Felaket tohumunda (777 savunma) t=60: mühimmat 0.53→0.58, birim 17→20, kuru `[topçu:1 havan:2]`→**boş**;
t=50 atış 67 olay/673 hasar → **124 olay/1618 hasar** (aynı mühimmatla **2.4× hasar** — kısıtlama değil verim).
Sonuç: savunan t=130'da imha → **maç sonuna kadar ayakta**.

### ⭐ SIRADAKİ DARBOĞAZ: SALDIRAN (saldıranken hâlâ 1/4)

An-be-an (seed777, mavi saldıran, pro, **imha edildi**):

| sn | mavi ₺ | birim | mühimmat | bastırma | mesafe | kırmızı hasar |
|---|---|---|---|---|---|---|
| 30 | 6040 | 23 | 0.93 | 0 | 1516 | 514 |
| 40 | **4750** | **16** | 0.82 | 6 | **605** | **1585** |
| 50 | 3330 | 13 | 0.85 | 0 | 341 | 707 |
| 80 | 2220 | 6 | 0.88 | **50** | 156 | 491 |
| 100 | 240 | 1 | — | — | — | 616 |

**Mekanizma bambaşka:** saldıran **dolu şarjörle** ölüyor (mühimmat 0.82-0.91 boyunca yüksek) — bu bir mühimmat sorunu DEĞİL.
Angajman mesafesi 1516 → 605 → 341'e çöküyor: saldıran, savunanın hazırlanmış ateş bölgesine **yürüyor** ve
**t=30-40 arasında 10 saniyede 7 birim** kaybediyor. Üstelik bunu **POSITION duruşundayken** yapıyor (STRIKE'a ancak
t=60'ta, 12 birime düştükten sonra geçiyor). Yani duruş-kapısı STRIKE'ı yönetiyor ama **yaklaşma POSITION'da
denetimsiz** — kısa menzilli kütle (MBT 450 / piyade 300) savunanın uzun menzilli zarfını (AT 525, topçu 900+)
yumuşatmadan geçmek zorunda kalıyor.

**Aday kaldıraçlar:** (a) POSITION'da yaklaşma mesafesini savunanın etkili zarfına göre kısıtla,
(b) yaklaşmayı bastırma-örtüsüne bağla, (c) yaklaşmayı tek hamlede eş-zamanlı yap.

#### (b) ÖLÇÜLDÜ ve ÇÜRÜDÜ ❌ — "yumuşatma yetersizliği" saldırıyı açıklamıyor
20 maçlık ayna örneklemi (10 tohum × 2 rol, **iki taraf da pro**), saldıranın kütlesi kapanmadan (ort. angajman
mesafesi <700) önce savunana verdiği hasar ölçüldü:

| | yumuşatma % | bunun dolaylı payı | kapanma anı |
|---|---|---|---|
| KAZANAN saldırı (6) | %11.0 | %7.1 | 48.3sn |
| KAYBEDEN saldırı (14) | %8.1 | %3.1 | 38.6sn |

**Korelasyon r = 0.131** → ilişki yok. En yüksek yumuşatmayı yapan (%36.1) **kaybetti**; kazananlardan ikisi
**%0.1 ve %1.4** yumuşatmayla kazandı. → Yaklaşmayı bastırma-örtüsüne bağlamak veri tarafından **desteklenmiyor**.

#### BÜTÇE SONDAJI — savunma üstünlüğü HAFİF, doktrinle kapatılabilir ✅
`--budgetprobe` (ayna, 4 tohum × 2 rol = 8 maç/kademe, iki taraf da pro):

| saldıran bütçesi | saldıran galibiyeti |
|---|---|
| 6500 (1.0×, eşit) | %37.5 |
| 8125 (1.25×) | **%75** |
| 9750 (1.5×) | **%100** |

**Denge noktası ≈ 1.10–1.15×.** Yani saldıranın açığı yalnızca **%10-15 bütçe eşdeğeri** — tarihsel 3:1'in çok altında.
İki sonuç: (1) bu bir kural-düzeyi dengesizliği DEĞİL, **doktrinle kapatılabilir** bir açık;
(2) duyarlılık dik (+%25 bütçe → +37.5 puan galibiyet) → **kompozisyon verimliliğinde %10-15'lik bir kazanım rolü çevirir.**
Kullanıcının "AI'lar daha iyi bütçe takası yapmalı" sezgisi bu tabloyla destekleniyor.
*(Mezuniyet her zaman eşit bütçeyle koşulur; bu yalnız teşhistir.)*

#### (a) vs (c) AYIRT EDİCİ ÖLÇÜM — SONUÇSUZ ⚠️
Saldıranın **eşzamanlı temas oranı** (kendi menzilinde canlı düşmanı olan birim / toplam birim) ölçüldü (8 maç):

| | tepe temas oranı |
|---|---|
| KAZANAN saldırı | %32, %57 |
| KAYBEDEN saldırı | %36, %45, %48, %48, %50, %53 |

Ayrım yok — kazananlar aralığın hem altında hem üstünde. **(a) ve (c) bu ölçümle ayrışmadı.**

**Yine de sağlam bir yapısal gözlem:** saldıran ordu kuvvetinin **hiçbir zaman ~%57'sinden fazlasını aynı anda
temasa sokamıyor** (tipik %32-53). Yani ordunun yarısı sürekli boşta. Bu, parça-parça saldırı (c) lehine bir
gösterge ama **galibiyetle ilişkisiz** olduğu için tek başına kaldıraç sayılmaz.

#### ⭐⭐ YEREL KUVVET ORANI — İLK GÜÇLÜ SİNYAL (r = 0.72)
Ölçüm: bir birim **vurulduğu anda** 600px çevresinde kaç DOST / kaç DÜŞMAN var (kurbanın gözünden).
12 maç, ayna, iki taraf da pro:

| saldıranın yerel oranı | KAZANAN saldırı | KAYBEDEN saldırı | r |
|---|---|---|---|
| tüm maç | **7.86** | **2.23** | 0.720 |
| ilk 60sn | **10.75** | **3.43** | **0.748** |
| ilk 80sn | 8.82 | 3.15 | 0.678 |
| ilk 40sn | 13.93 | 5.72 | 0.417 |

**Sağkalım yanlılığı testi geçildi:** ilişki **t=60'ta** zaten en güçlü (r=0.748) — maçlar 130-360sn'de bitiyor
ve t=60'ta iki taraf da kuvvetinin ~%70-80'ini koruyor. Yani bu, kazanmanın *sonucu* değil **öncülü**.

**Yorum:** saldırı, birimleri vurulduğu anda **yerel olarak 3× üstün** olduğunda kazanıyor; 2:1 civarında kaybediyor.
Global bütçe eşitken bile fark eden şey **yoğunlaşma**.

**Diğer bulgularla tutarlı:**
- Saldıran ordu kuvvetinin en fazla ~%57'sini aynı anda temasa sokabiliyor (yarısı boşta) → yoğunlaşma eksikliği.
- Bütçe sondajı: %10-15'lik verim kazanımı rolü çeviriyor. Yerel 3:1 dövüşmek tam olarak böyle bir çarpan.
- → Aday **(c) eş-zamanlı/yoğunlaşmış taahhüt** destekleniyor; (a) yaklaşma-mesafesi kısıtı desteklenmiyor.

**Gerilim (dikkat):** `deblob`/sektör-komuta yığılmayı DAĞITIYOR (topçudan korunmak için), yoğunlaşma ise
tersini istiyor. Doğru çözüm muhtemelen "her yerde dağıl" değil **ana-çabada yoğunlaş, gerisinde dağıl**.

**Uyarı:** n=12, korelasyon nedensellik değildir. Uygulama yine bayraklı + A/B ile sınanmalı.

#### Yapısal bulgu: ayna maçta saldıran **6/20 = %30**
İki taraf da aynı beyin ve **eşit 6500₺** iken saldıran yalnız %30 kazanıyor
(`attacker_eliminated` 7, `attacker_withdrew` 3 → saldıran maçların **yarısında** kırılıyor).
Bu bir **AI kusuru mu yoksa senaryo/kural yapısı mı** ayırt edilmedi. Ayırt etmenin ucuz yolu:
saldırana kademeli bütçe üstünlüğü verip **denge noktasını** bulmak (tarihsel 3:1 kuralı gerçekçi olabilir).

**Mezuniyet açısından not:** kapı rolleri takasladığı için yapısal savunma eğilimi **sadeleşir**;
pro'nun mezun olması için gereken şey "saldırıyı mutlak olarak düzeltmek" değil,
**pro-saldıranın intel4-saldırandan iyi olması** (şu an A/B'de 1/4 vs 0/4 — zayıf).

### P1 — 1. DENEME: ÖLÇÜLDÜ, ETKİSİZ ❌ (2026-08-04)
`ammoDiscipline` deltası yazıldı (`PRO_AMMO_RESERVE=0.45`, `PRO_AMMO_CLOSE_FRAC=0.60`) ve mezuniyet kapısında ölçüldü:
**pro 6/12 = %50** (eşik %75) → mezun değil. Determinizm kapıları temiz (`--forktest`, `--liverepro`).

**Neden etkisiz olduğu — iki ayrı kusur:**

1. **Eşik ÇOK GEÇ tetikleniyor.** Kural mühimmat ≤%45'e inince devreye giriyor; ama teşhisteki yanma
   **t=30-50 arasında 0.85 → 0.61** aralığında oluyor. Yani kural, mühimmatın yarısı zaten harcandıktan
   *sonra* açılıyor. Ölçüm: t=60'ta ortalama mühimmat **pro 0.785 vs intel4 0.760** — fark %2.5, gürültü seviyesinde.
   (Tek istisna felaket tohumu 777: pro 0.70 / 0 kuru vs intel4 0.53 / **3 kuru** → orada mekanizma çalıştı ve pro kazandı.)

2. **ÖLÇÜM KUSURU (bende):** kapı `attackerSide: true` sabitliyor → **mavi DAİMA savunan**. Kural yalnız savunana
   uygulandığı için `pro=red` olan 6 maçta pro-katmanı **tamamen etkisiz** (kırmızı saldıran). O 6 maç
   pro'yu değil yalnız **taraf yanlılığını** ölçtü (kırmızı 12 maçın 8'ini kazandı).
   Anlamlı alt-küme `pro=blue` (6 maç): disiplinli savunan **2/6**, disiplinsiz savunan da **2/6** → **fark yok.**

**Sonraki deneme (P1b):** erken yanmayı hedefle — eşiği yükseltmek yerine **uzak-menzil tacizini baştan oranla**
(ör. düşman kararlı banda girene dek uzak hedefe atış hız-sınırı), ve kapıyı **saldıran tarafı da takaslayacak**
şekilde düzelt. Ucuz yineleme `--matchtimeline` ile yapılır; mezuniyet kapısı yalnız kullanıcı isteyince koşulur.

### P1 (özgün tasarım) — Savunan için MÜHİMMAT DİSİPLİNİ
Planın "ihtiyat" kavramının mühimmat karşılığı. Fikir: savunan, düşman **kararlı menzile** girmeden mühimmatının
belirli bir oranından fazlasını harcamasın (ör. temas öncesi ≤%40); uzun menzilli taciz ateşi **oran-sınırlı** olsun.
- Bayraklı yeni delta (`ammoDiscipline`), varsayılan kapalı.
- **Kabul:** felaket-kayıp maçlarında savunanın t=60 mühimmatı ≥0.7 ve atış hacmi düşüşü ≤2× olsun;
  `--matchtimeline` ile doğrula, `--vstournament` ile regresyon kontrolü.
- **Risk:** taciz ateşini kısmak savunanı pasifleştirebilir → ölçmeden benimseme.

### P2 — Negatif mühimmat kelepçesi
Tüketim noktalarında `ammo = max(0, ammo − 1)`. Küçük ama determinizm kapılarından geçmeli (sim davranışı değişir).

### P3 — Toplam metrikleri "gerçek bitiş"e kadar hesapla
`--intel4selfplay` ve diğer toplayıcılar maç bitince ölçümü DURDURSUN. Şu anki toplamlar (kayıp₺, yoğunluk)
maç-sonrası ölü hava ile kirli — bu düzeltilmeden hiçbir toplam metrik güvenilir değil.

### P4 — "Ort. menzil ≥900" kabulünü sınıf-bazlı yeniden tanımla
Global ortalama saldıran/savunan rolüne göre 400 ↔ 1000 arası değişiyor; tek eşik anlamsız.
Sınıf-başı (menzil≥520 olanlar için) ölçülmeli.

---

**Yöntem notu:** Bu belgedeki her sayı güncel motorla, bu oturumda alındı. Eski ölçümler (farklı bütçe/motor) referans alınmadı.
İlgili: [[pixel-rts-plan-bayatligi]] · [[pixel-rts-intel4-selfplay-bulgular]]
