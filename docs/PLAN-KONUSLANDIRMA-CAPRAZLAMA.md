# PLAN — Konuşlandırma Çaprazlaması (intel4-pro'nun ana ekseni)

Tarih: 2026-08-04 · Dal: `savas-ai-mikrofix-konsantrasyon` · Durum: **ONAY BEKLİYOR**
Öncesi: [SAVUNAN-BOLGE-TUTMA.md](SAVUNAN-BOLGE-TUTMA.md) · [KUVVET-ORANI-DUZELTME-SONUC.md](KUVVET-ORANI-DUZELTME-SONUC.md)

---

## 0. Neden burası

Üç bağımsız ölçüm aynı kapıya çıktı:

| bulgu | ölçüm | tarih |
|---|---|---|
| Saldıran eşit bütçede **0/6** kaybediyor | `--intel4pro --only _yok_`, iki taraf bit-bit özdeş | 2026-08-04 |
| Savunan yer **tutamıyor**: ₺'sinin %0–30'u siperlenebiliyor, 1 istihkâm | `--zonedrift`, `--armydump` | 2026-08-04 |
| `forceRatio` düzeltmesi eşit bütçede **nötr** | izole A/B 2/6 vs kontrol 3/6 | 2026-08-04 |

Yani karar-katmanı deltaları (duruş, oran, kohezyon) tavana vurdu: **AI'ın elindeki orduyla
yapılabileceklerin sınırındayız.** Savunan, saldıranla neredeyse aynı taarruzi orduyu alıyor ve
ikisi de aynı ızgaraya diziliyor. Kapının açılacağı yer konuşlandırma.

**Mezuniyet kısıtı:** kapı 6 tohum × 2 rol. Saldıran rolü çözülmeden pro'nun tavanı %50 →
**%75 matematiksel olarak imkânsız.** Bu yüzden plan saldıran-rolüne öncelik verir.

---

## 1. Ön koşul — FAZ 0: konuşlandırmayı ÖLÇÜLEBİLİR PARAMETRE yapmak

**Süpüremediğin şeyi çaprazlayamazsın.** Bugün kompozisyon, `battleBuildArmyManifest` içindeki
ağırlık/taban/tavan/artık-harcayıcı yığınından *ortaya çıkan* bir yan etki. Önce onu **veri**ye
çevirmeliyiz.

### 0.1 Tarif (recipe) formatı
```json
{ "ad": "piyade-mevzi", "rol": "defender",
  "paylar": { "infantry":0.34, "armor":0.18, "indirect":0.16, "air_defense":0.10,
              "recon":0.06, "support":0.10, "logistics":0.06 },
  "zorunlu": { "ENGINEER":3, "SUPPLY_TRUCK":1 },
  "tavan":   { "ANTI_TANK":4 },
  "artik":   ["MLRS","ARMOR"] }
```
Kategoriler `--armydump`'takiler: `infantry, armor, indirect, support, recon, air_defense, uav,
logistics, air`.

### 0.2 Çözücü (deterministik)
Açgözlü **pay-açığı** doldurma; eşitlik bozucu sabit tip sırası; `zorunlu` önce, `tavan` sert,
kalan para `artik` listesinden en-pahalıdan. **RNG yok** (mevcut `varied` yolu srand kullanıyorsa
tarif modunda kapatılır → aynı tarif + aynı bütçe = byte-aynı ordu).

### 0.3 Denetim (her koşuda zorunlu, sessiz kırpma yasak)
`--recipeaudit`: harcanan ₺ = bütçe? (bütçe-kaçağı 560₺ vakası tekrarlamasın) · hedef pay ↔ gerçek
pay sapması kategori başına · doldurulamayan pay · atılan birim. Sapma >%5 olan hücre **rapor edilir**,
gizlenmez.

### 0.4 Kabul
Aynı tarif 3 kez → aynı ordu (byte). `--forktest`/`--liverepro`/`--defertest` yeşil.
**FAZ 0 bitmeden hiçbir ölçüm anlamlı değildir.**

---

## 2. Çaprazlanacak eksenler

| eksen | değerler | not |
|---|---|---|
| **A. Rol** | saldıran, savunan | her hücrede ikisi de |
| **B. Kompozisyon tarifi** | R0(mevcut), RU(insan), + arketipler | asıl eksen |
| **C. Yerleşim deseni** | P0–P5 (§6) | "nereye" ekseni |
| **D. Rakip tarifi** | aynı arketip kümesi | ÇAPRAZLAMANIN kendisi |
| **E. Tohum** | 2024, 777, 909, 3141, 2718, 5150 | tarama 3, doğrulama 6 |

Tam çarpım kombinatorik olarak patlar → **kademeli indirgeme**: ana etkiler → turnuva → etkileşim.

---

## 3. FAZ 1 — Taban haritası (ölçüm, kod yok)

1. `--armydump` 6 tohum × 2 rol → mevcut AI'ın fiili kategori payları = **R0** (rol başına ayrı).
2. Kullanıcının kendi listeleri (`qa-runtime/kompozisyonlar.json`, seed777 + seed2024) → **RU**.
3. Kontrol koşusu tekrar: R0 vs R0, 6 tohum → taraf/tohum yanlılığı tabanı (bugün: savunan 6/6).

**Çıktı:** R0 ve RU'nun pay tabloları yan yana. Kullanıcı 2.7× verimli oynuyordu — farkın
kompozisyonda mı komutada mı olduğunu FAZ 3 söyleyecek.

---

## 4. FAZ 2 — Ana etkiler (tek-faktör süpürmesi)

Her kategori için payı ±%50 oynat, kalanı orantılı yeniden normalize et. Diğer her şey sabit.

Eksen başına 3 nokta (düşük / R0 / yüksek) × 9 kategori × 2 rol × 3 tohum (tarama)
= **162 maç**. Kazananlar 6 tohumda doğrulanır.

**Neden önce bu:** gradyanı ucuza verir ve arketipleri tahminle değil **ölçümle** kurar.

**Ön-kayıtlı hipotezler** (sonradan hikâye uydurmayı engellemek için önceden yazılır):
- H1: savunanda `infantry` payı ↑ → siperlenebilen pay ↑ → yer tutma bedeli düşer
- H2: savunanda `support`(istihkâm) ↑ → kurulu siper ↑ → örtü payı ↑
- H3: saldıranda `indirect` ↑ → savunma hattı yumuşar (saldıran 0/6'yı kıran şey)
- H4: `air` (helo 800₺) payı ↓ → aynı parayla hat gücü ↑

Her hipotez, sonuç metriğinin YANINDA **mekanizma metriğiyle** sınanır (siperlenebilen pay,
kurulu siper, örtü payı, mühimmat eğrisi, angajman mesafesi). Sonuç iyileşip mekanizma
değişmediyse → tesadüf sayılır, kabul edilmez.

---

## 5. FAZ 3 — Arketip × Arketip turnuvası (ASIL ÇAPRAZLAMA)

FAZ 2'nin kazananları + doktrinel arketipler, 6 tarif:

| kod | ad | tezi |
|---|---|---|
| A1 | Zırhlı Mızrak | dar cephede zırh yığ, hızla kır |
| A2 | Ateş Üssü | dolaylı ağırlıklı, uzaktan erit |
| A3 | Piyade-Mevzi | siperlenebilen kütle + istihkâm |
| A4 | Dengeli (R0) | mevcut AI — **kontrol** |
| A5 | Keşif-Vur | keşif + hassas vuruş (kullanıcı profili, RU) |
| A6 | FAZ-2 kazananı | ölçümün kendi önerisi |

**Tam çapraz:** 6 saldıran × 6 savunan × 3 tohum = **108 maç** (tarama).
Sonuç: **kazanç matrisi** — hücre değeri = kazanma + `effectiveValue` marjı (marj daha düşük
varyanslı; 3 tohumla tek başına kazanç oranına güvenilmez).

Matristen üç okuma:
1. **En iyi saldıran** = tüm savunanlara karşı ortalaması en yüksek satır
2. **En iyi savunan** = tüm saldıranlara karşı ortalaması en yüksek sütun
3. **Taş-kâğıt-makas var mı?** Baskın satır yoksa geçişsizlik vardır → §7 devreye girer

Baskın çıkanlar 6 tohumda doğrulanır.

---

## 6. FAZ 4 — Yerleşim geometrisi (konuşlandırmanın "nereye"si)

Bugün herkes aynı ızgaraya diziliyor (`BattleDeployment` satır ~523: sabit `forwardY`, sütun
aralığı, halka). Desenler:

| kod | desen | tezi |
|---|---|---|
| P0 | mevcut ızgara | **kontrol** |
| P1 | derinlik-katmanlı | kategoriye göre derinlik (dolaylı 0.25 / AD 0.35 / zırh 0.55 / piyade 0.70) |
| P2 | örtü-çıpalı | piyade ormana; orman +3 zırh & 0.40 örtü **herkese** |
| P3 | ağırlık-merkezli | kütlenin %60'ı tek sektöre (schwerpunkt) |
| P4 | geniş-cephe | eşit dağılım, alan-ateşine hedef verme |
| P5 | ters-yamaç (savunan) | hattın gerisi + yükselti arkası |

Maliyet kontrolü: P eksenini **yalnız FAZ 3'ün ilk 2 arketipiyle** çapraz: 6 desen × 2 arketip ×
2 rol × 3 tohum = **72 maç**.

`holdZone` burada yeniden açılır: derinlik-katmanlı yerleşim + piyade-ağırlıklı tarif, yer tutmanın
bugün ~%6 olan karşılığını yükseltmeli. **Ölçüt:** siperlenebilen pay ≥0.45 ve örtü payı ≥0.30
olmadan `holdZone` açılmaz.

---

## 7. FAZ 5 — Seçim kuralı

- Matris **baskın** bir tarif veriyorsa → onu rol başına sabitle. Bitti.
- **Geçişsizse** (taş-kâğıt-makas) iki seçenek ölçülür:
  - **En-iyi-cevap:** intel4'ün R0'ına karşı en iyi tarif → kapıyı geçirir ama R0'a aşırı-uyum riski
  - **Maximin:** en kötü durumu en iyi olan tarif → "her alanda geçmek" bunu gerektirir
  Kullanıcının hedefi *"her alanda geçebilir"* olduğu için **maximin asıl ölçüt**, en-iyi-cevap
  yalnız referans olarak raporlanır. İkisi ayrı ayrı bildirilir; biri diğerinin yerine geçmez.
- Savaş-öncesi istihbarat (tehdit-profili katmanı) varsa uyarlanabilir seçim FAZ 6'ya bırakılır —
  **bu planın kapsamı dışında.**

---

## 8. Ölçüm disiplini (geçmişte yanılttığımız yerler)

1. **Bütçe denetimi her koşuda** — 560₺'lik kaçak tüm denge ölçümlerini kirletmişti.
2. **Kontrol hücresi zorunlu** — R0 vs R0. Taraf yanlılığı bilinmeden hiçbir sayı okunamaz
   (savunan 6/6 kazanıyor; bunu bilmeden "iyileşme" ilan etmek hataydı).
3. **Tek değişken** — tarif sınanırken yerleşim sabit, yerleşim sınanırken tarif sabit.
4. **Sağkalım yanlılığı** — kazananın toplamları iyi görünür çünkü kazanmıştır. Metrikler
   **erken pencerede** (t≤120sn) de okunur.
5. **Marj + kazanç birlikte** — 3 tohumda kazanç oranı gürültülüdür.
6. **Mekanizma metriği olmadan kabul yok** — sonuç iyileşti ama hedeflenen mekanizma
   değişmediyse tesadüftür (`indirectMassing`'in 1/8→4/8'i bütçe-kaçağı artefaktıydı).
7. **Determinizm kapıları** her kod değişiminden sonra: `--forktest`, `--liverepro`, `--defertest`.
8. **Sessiz kırpma yasak** — kapsam daraltılırsa (tohum azaltma, tarif eleme) neyin düştüğü yazılır.

---

## 9. Maliyet

Ölçülen: 6 maç ≈ 3–6 dk (başsız). Yani ≈ **40 sn/maç**.

| faz | maç | tahmini süre |
|---|---|---|
| 1 taban | 12 + 6 | ~15 dk |
| 2 ana etkiler | 162 | ~1s 50dk |
| 3 turnuva (tarama) | 108 | ~1s 15dk |
| 3 doğrulama (6 tohum) | ~36 | ~25 dk |
| 4 geometri | 72 | ~50 dk |
| **toplam** | **~400** | **~4.5 saat** başsız koşu |

FAZ 0 (tarif sistemi + denetim) kodlaması ayrı. Koşular arka planda yürütülebilir; her fazın
sonunda kullanıcıya ara rapor.

---

## 10. Kabul ölçütleri ve durdurma kuralları

**Faz kapıları**
- FAZ 0: tarif→ordu byte-tekrarlanabilir + bütçe kaçağı 0 + determinizm yeşil
- FAZ 2: bir eksen ≥+2 kazanç (6 tohum) **ve** mekanizma metriği hedeflendiği yönde değişmiş
- FAZ 3: bir tarifin tüm rakiplere karşı ortalama marjı pozitif (baskınlık) — yoksa §7
- FAZ 4: `holdZone` için siperlenebilen pay ≥0.45 **ve** örtü payı ≥0.30

**Durdurma (bir arketip/eksen terk edilir)**
- 6 tohumda kontrolün altında **ve** mekanizma metriği hedeflenen yönde değişmemişse
- veya bütçe denetimi tutmuyorsa (ölçüm kirli → önce onar)

**Mezuniyet kapısı** (`--intel4pro`, 6 tohum × 2 rol, ≥9/12) **yalnız kullanıcı söyleyince**
koşulur. Kullanıcı: *"her seferinde mezuniyet kapısı koşma onu ben sana söylerim."*

---

## 11. Riskler

| risk | karşılık |
|---|---|
| R0'a aşırı-uyum (kapıyı geçer, insana karşı çöker) | maximin asıl ölçüt; RU (insan tarifi) turnuvada rakip olarak var |
| Geçişsiz matris → tek tarif yok | FAZ 5'te açıkça raporlanır; uyarlanabilir seçim ayrı faz |
| Tarif çözücüsü mevcut taban/tavan mantığıyla çakışır | tarif modunda eski heuristikler KAPALI; ikisi karışmaz |
| 400 maçlık koşu bütçesi | fazlar bağımsız; her faz sonunda dur/devam kararı kullanıcıda |
| Yerleşim değişimi determinizmi kırar | her desen sonrası 3 kapı; desenler saf fonksiyon, RNG yok |

---

## 12. İlk adım

Onay gelirse **FAZ 0** ile başlanır: tarif formatı + deterministik çözücü + `--recipeaudit`
denetimi + `--recipeab` çapraz koşucusu. Ölçüm ancak ondan sonra anlamlıdır.
