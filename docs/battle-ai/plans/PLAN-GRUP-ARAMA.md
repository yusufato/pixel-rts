# GRUP ARAMASI — aramanın eylem uzayını birimden müfrezeye çıkarmak

**Durum:** planlanıyor (2026-08-20). Uygulama, açık kuyruk bittikten sonra.
**Gerekçe:** bugün iki bağımsız yönden aynı duvara çarpıldı ve ölçülmüş üç kusurun kökü
aynı çıktı.

---

## 1. Bugünkü aramanın şekli (koddan)

Bir karar çevriminde:

```
LA_BIRIM (20) birim
  × battleLookaheadAdaylar → 1 + LA_HALKA(3) × LA_YON(8) = 25 aday nokta
  → analitik ön eleme (bedava)
  → LA_DERIN (5) aday GERÇEKTEN oynatılır: fork + LA_UFUK (300 tik) + skor + restore
= ~100 rollout / karar çevrimi
```

Her aday **tek bir birimin** en fazla `LA_YARICAP` (600px) uzağa yürümesidir.

---

## 2. Bu darlığın ölçülmüş üç bedeli

| ölçülmüş kusur | kaynak | sayı |
|---|---|---|
| kararların bir kısmında adaylar arası yayılım **sıfır** | `tools/gelecek-yelpazesi.js` | **%29** |
| değer ağı aday sıralamada **rastgeleden kötü** | `tools/ucuz-puan-ongoru.js` | %10,8 vs taban %18 (n=55) |
| manevra **ifade edilemiyor** | bugün, iki yönden | aşağıda |

Üçünün de kökü aynı ve kod bunu zaten yazıyor:

> *"adaylar birbirinden **tek bir birimin nereye yürüyeceği kadar** farklı ve global durum
> değeri o farkla değişmiyor"*

Yayılım sıfırsa rollout **saf israf** — %29'luk bir bütçe kaybı. Ve değer ağı (ρ 0,86,
global durum için eğitilmiş) o kadar küçük farkları ayırt edemiyor; ağın "başarısız"
olması ağın kusuru değil, **sorunun ölçeğinin yanlış** olması.

### Manevranın ifade edilemediği iki kanıt (2026-08-20)

1. **Karşı-plan halkası.** *"Topçuyu bul → kanattan bas → kalanı dağıt"* üç katmanda
   denendi, üçü de düştü. Sektör ataması x-bandı; `contract.destination` MAIN/FLANK için
   okunmuyor; doğrudan baskın emri grubu hatta sürüp öldürüyor.
2. **`yerel_ustunluk` sömürücüsü.** İnsanın ölçülmüş imzası 7,4:1 yerel oran; bot en
   seçici hâlinde 3,11'e çıkıyor ve o noktada AI'ya maçı hediye ediyor (sağkalım
   %4→%81). Çünkü **temastan kaçınmak** yerel üstünlük üretmiyor; insan onu
   **kütleyi yığıp zayıf noktaya vurarak** kuruyor.

İkisi de aynı şeyi istiyor: *çok birimi birlikte, bir amaca göre hareket ettirmek.*

---

## 3. Öneri: grup adayları

Aday uzayı birim değil **görev grubu** olur. Grup soyutlaması **zaten var**
(`taskGroups`: MAIN / FIXING / FLANK / RECON / FIRE_SUPPORT / SUPPORT / RESERVE,
`assignSectors` ile sektöre atanıyor).

Aday örnekleri (her biri 5-15 birimi birlikte oynatır):

| aday | ne yapar |
|---|---|
| MAIN → sol / merkez / sağ sektör | ana çabayı kaydır |
| FLANK → geniş sol / geniş sağ | kuşatma kolu |
| kütle → çıkarılmış tehdit konumu | *(inanç katmanı buraya bağlanır)* |
| konsolide / bekle | mevcut hattı tut |

### Neden bu üç kusuru birden çözer

- **Yayılım:** bir grubu sektör değiştirmek, tek birimi 600px yürütmekten mertebe olarak
  daha büyük bir durum farkı üretir → "%29 sıfır yayılım" yapısal olarak küçülür.
- **Değer ağı:** ağ global durum için eğitildi ve orada iyi (ρ 0,86). Grup adayları
  arasındaki fark **global ölçekte** olduğu için ağ bu sefer ayırt edebilir. Yani
  `LA_AG_KAPI` (bugün kapatıldı, +897) grup adaylarında **yeniden değerlendirilmeli**.
- **Manevra:** karşı-plan ve sömürücünün istediği nesne doğrudan bir aday olur.

### ⭐ Ve muhtemelen DAHA UCUZ

```
bugün : 20 birim × 5 aday          = ~100 rollout / çevrim
grup  : ~6 grup adayı × 5 tepki    = ~30 rollout / çevrim
```

Rollout ölçülmüş darboğaz. Grup araması hem **daha ifade edici** hem **3× daha ucuz**
olabilir. Bu, bugüne kadarki "ucuzlatma girişimleri çöküyor" kuralına aykırı değil —
çünkü burada **yaklaşıklık yok**: rollout yine tam simülasyon, yalnız *ne denendiği*
değişiyor.

---

## 4. İlk adım — inşa etmeden önce ÖLÇ

Bütün tasarımın dayandığı iddia tek: **grup adayları arası yayılım, birim adayları arası
yayılımdan belirgin şekilde büyüktür.** Bu, `tools/gelecek-yelpazesi.js`'in %29'u
ölçtüğü aletle doğrudan sınanabilir ve **inşaat gerektirmez**:

1. Mevcut kararlarda birim-adayları arası yayılım dağılımını çıkar (zaten var: %29 sıfır).
2. Aynı durumlarda 6 grup adayını üret, her birini rollout'la, yayılımı ölç.
3. Grup yayılımı belirgin büyükse tasarım ayakta; değilse **bu plan da düşer**.

Bu ölçüm bir maç kapısı değil; birkaç saatlik mekanizma ölçümü. Bugünün dersi tam da bu:
*maç kapısına girmeden önce mekanizmayı ölç* — 11 pro-delta bu sayede ~66 saat yerine
~3 saatte elendi.

---

## 5. Riskler ve sınırlar (peşinen)

- **İncelik kaybı.** Grup hareketi, birimin yerel konumlandırmasını kabalaştırabilir.
  Çare muhtemelen **melez**: manevra kararı grup adaylarıyla, yerel mevzi birim
  adaylarıyla. Ama bu varsayım değil, ölçülecek bir soru.
- **Grup üyeliği kaygan.** `taskGroups` her plan çevriminde yeniden kurulur; aday
  "MAIN'i sola kaydır" derken MAIN'in kim olduğu değişebilir. Kalıcı `groupId` var
  (`assignPersistentGroupIds`) — kullanılmalı.
- **Determinizm.** Rollout yine fork/restore; aday üretimi saf aritmetik. Bugünkü
  garantiler bozulmaz — ama kapı yine de koşar.
- **"Daha ucuz" iddiası ölçülmemiştir.** Grup adayında daha çok birim hareket ettiği için
  tik başına maliyet artabilir; net etki ölçülmeli.

---

## 6. Bu planı NE ÇÜRÜTÜR

- Grup adayları arası yayılım da küçük çıkarsa (adım 4) → plan düşer.
- Yayılım büyük ama maç kapısı geçmezse → "ifade edilebilirlik kazanç değildir" öğrenilir;
  bugünkü 11 pro-delta gibi kayda geçer.
- Melez sürüm gerekiyorsa maliyet iki katına çıkar ve "daha ucuz" iddiası düşer.

Üçü de kabul edilebilir sonuçlar. Plan, kazanacağını değil **ölçülebilir olduğunu**
iddia ediyor.


---

## 7. ADIM 4 ÖLÇÜLDÜ (2026-08-20) — **iddia ayakta**

`tools/grup-yelpazesi.js`, 4 tohum · 2 an · 3 çapa · ufuk 200 tik (10sn).
**Kontrollü karşılaştırma:** iki kolda da aynı hedef noktaları (aynı geometri, aynı
sayı); tek fark kaç birim oynadığı. Böylece "yayılım farkı noktaların mı kütlenin mi"
karışmıyor.

| kip | ölçüm | ort yayılım | medyan | sıfır yayılım | **en iyi − kal** | t |
|---|---|---|---|---|---|---|
| BİREY (1 birim) | 18 | 165 | **0** | **%66,7** | 46 | 1,76 |
| KÜTLE (8 birim) | 18 | **743** | 940 | %16,7 | **282** | **3,55** |

- **Yayılım oranı 4,50×**
- **Sıfır yayılım %66,7 → %16,7**
- **"En iyi − kal"**: seçimin *yerinde kalmaya göre* kazandırdığı. Tek birimle
  ölçülemiyor (46, t 1,76); kütleyle **282, t 3,55** — anlamlı.

Birey kolunun **medyan yayılımı sıfır**: kararların yarıdan fazlası tamamen önemsiz.
Kayıtlı %29 rakamı bu kurulumda daha da kötü çıkıyor (farklı ufuk/yarıçap, ama yön aynı).

### Bu ne demek, ne demek DEĞİL

**Demek:** aramanın harcadığı rollout bütçesinin büyük kısmı, sonucu değiştirmeyen
seçimlere gidiyor. Kütle adayları hem daha çok fark yaratıyor hem de o farkın
**yönü ölçülebilir** hale geliyor.

**Demek DEĞİL:** aramanın kütle adaylarıyla maç kazanacağı. Bu ölçüm *seçimin önemli
olduğunu* gösteriyor, *arama iyi seçecek* demiyor. O ayrı bir kapı.

### Dürüstlük notları

- n=18 ölçüm 4 tohumdan; aynı tohum içindeki ölçümler bağımsız değil.
- "Kütle" burada kaba bir kurgu (en yakın 8 birim, formasyonu koruyarak) — gerçek
  `taskGroups` değil. Gerçek grup adayları farklı davranabilir.
- Rollout içi kazanç ölçüldü, **maç sonucu değil**.

### Sıradaki adım

Gerçek grup adayları (`taskGroups` + kalıcı `groupId` üzerinden: MAIN sol/merkez/sağ,
FLANK geniş kuşatma, kütle → çıkarılmış tehdit konumu) ile aynı ölçüm; sonra maç kapısı.
