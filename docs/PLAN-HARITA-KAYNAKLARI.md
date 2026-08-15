# Harita kaynakları ve şehirler — geliştirme planı

Bu plan **ölçülmüş bir tabandan** başlar. Aşağıdaki her sayı canlı kampanyadan
(152 düğüm, tohum 777, 300 oyun-saniyesi) okunmuştur; tahmin yoktur.

Damga kuralı: her aşama `AÇIK` · `UYGULANDI <commit>` taşır. Hash'siz damga
geçersizdir. Sayılar bayatlar — bir aşamaya girmeden önce tabanı yeniden ölç.

---

## Ölçülmüş taban (2026-08-15)

### İki ayrı kaynak sistemi var

**Katman A — harita yatakları (`STORY.nodes[]`), 3 çeşit + şehir tabanı:**

| yatak | kaç şehirde | toplam | ekonomiye bağlantısı |
|---|---|---|---|
| ⛽ `oil` | 16 / 152 | 32 | `energy_potential` + enerji sektör kapasitesi |
| ⛏ `mine` | 12 / 152 | 12 | `mineral_reserve` (çıkarma) |
| ⭐ `pts` | 20 / 152 | 32 | **hiçbir sektöre bağlı DEĞİL** |
| 👥 `cities` | 152 / 152 | 152 | `arable_capacity` (tarım) |

**118 şehirde (%78) hiçbir yatak yok.** Şehir seviyeleri: 108 × L1, 36 × L2, 8 × L3.

**Katman B — ekonomi kataloğu (`STORY_RESOURCE_IDS`), 8 çeşit:**

`food · energy · raw_materials · industrial_parts · electronics · military_supplies · labor · capital`

Pratikte **6**: `labor` DEFERRED (her bölgede stok 0), `capital` NUMERAIRE
(hesap birimi). Altısı 152 bölgede fiyat endeksi, stok kapsamı, bant ve rota
hasarıyla işliyor.

### Zincir aç kalıyor

Stoku **sıfır** olan bölge sayısı (152 üzerinden):

| kaynak | sıfır bölge |
|---|---|
| `military_supplies` | 47 |
| `food` | 41 |
| `raw_materials` | 37 |
| `industrial_parts` | 34 |
| `energy` | 31 |
| `electronics` | 6 |

Ortalama bağış: `arable 2.34` · `energy_potential 17.87` · `mineral_reserve 9576`.

### Bağlantı zinciri (kod)

`js/terrainData.js` (nokta listeleri) → `js/Story.js:1471` `assign()` →
`node.cities/oil/pts` → `js/StoryRegionalEconomy.js:192` bağışlar →
`js/StoryProductionSectors.js` reçeteler → `node.stocks` → `js/StoryMarket.js`
fiyat endeksi.

---

## Aşama 1 — `pts` yatağını ekonomiye bağla · `AÇIK`

**Neden ilk:** haritadaki üç yataktan biri ekonomiye hiç girmiyor. 20 şehirdeki
32 birim yalnız eski cüzdanın soyut "puan" gelirini besliyor. Yeni veri
gerekmez — var olan işaret bedavaya zincire girer.

**Ne:** `pts` = **uzman iş gücü / ileri teknoloji yatağı**.
`StoryRegionalEconomy` bağışlarına `research_capacity` (ya da mevcut
`sectorCapacity.advanced_tech`) eklenir; `pts` onu besler → `electronics`.

**Neden `electronics`:** stoku sıfır olan bölge sayısı en düşük olan kaynak (6),
yani zincirin en sağlam ucu. Oraya coğrafi çeşitlilik eklemek dengeyi bozmadan
haritayı anlamlı kılar. Ayrıca `advanced_tech` katalogda zaten `electronics`
üreticisi olarak tanımlı — yeni sektör açmaya gerek yok.

**Riskler:**
- `pts` aynı anda eski cüzdanın `points` gelirini besliyor; çift sayım olmamalı.
  Gelir formülü (`Story.js:1522`) değişmeden kalır, yalnız bağış eklenir.
- Determinizm: bağış hesabı tik sınırında ve tohumdan türemeli.

**Kabul ölçütü:**
- `pts > 0` olan 20 bölgede `advanced_tech` kapasitesi ölçülebilir şekilde artar
- `electronics` stoku sıfır olan bölge sayısı **artmaz**
- eski cüzdan `points` geliri **değişmez** (aynı tohumda birebir)
- `--forktest` yeşil · `--uitest` `PROBLEMS []`

---

## Aşama 2 — Maden yatağını haritaya çiz · `AÇIK`

**Ölçülen kusur:** `js/terrainData.js` içinde `cities`, `oil`, `pts` nokta
listeleri var ama **`mine` listesi YOK**. 12 şehirdeki maden şehir
konfigüründen (`Story.js:282` `c.mine`) geliyor — yani coğrafyadan değil.
Sonuç: hammadde zinciri haritaya oturmuyor, 37 bölgede `raw_materials` sıfır.

**Ne:** `terrainData.js`'e `mine: [[x,y], …]` listesi eklenir; `Story.js:1481`
civarındaki `assign()` çağrılarına `assign(STORY_TERRAIN.mine, 'mine')` girer.

**Kabul ölçütü:**
- maden taşıyan şehir sayısı 12 → hedeflenen sayıya çıkar, dağılım coğrafi
- `raw_materials` stoku sıfır olan bölge sayısı **azalır**
- `mineral_reserve` sonlu kalır (tükenme modeli bozulmaz)
- kaydedilmiş eski kampanyalar yüklenmeye devam eder

---

## Aşama 3 — `labor`'ı canlandır, ardından su · `AÇIK`

**Ölçülen kusur:** `labor` katalogda **7 sektörün girdisi** olarak tanımlı
(`AGRICULTURE, ENERGY, EXTRACTION, CIVIL_INDUSTRY, ADVANCED_TECH,
DEFENSE_INDUSTRY, MILITARY`) ama `StoryRegionalEconomy.js:185` her bölgede
`stocks.labor = 0` yazıyor ve piyasa durumu `DEFERRED`. Yani tanımlı ama ölü.

**Sıra önemli:** yeni bir 9. kaynak eklemeden önce mevcut 8'den ölü olanı
canlandırmak daha çok getirir — yeni kaynak da aynı boşluğa düşerdi.

**Sonra su (9. kaynak):** tarım ve enerji soğutma girdisi. Coğrafyası zaten
haritada: `terrainData.land` maskesi kara/deniz ayrımını tutuyor, nehir/kıyı
yakınlığı ondan türetilebilir — yeni çizim gerekmeden.

**Kabul ölçütü:**
- `labor` stoku 0'dan çıkar ve nüfusla (`node.pop`) ilişkilenir
- `labor` girdisi olan sektörlerin çıktısı iş gücü kıtlığında **düşer**
- su eklenirse: katalog hash'i değişir, kayıt göçü (migration) yazılır

---

## Aşama 4 — 118 özelliksiz şehre coğrafi karakter · `AÇIK`

**Ölçülen kusur:** 152 şehrin 118'inde hiçbir yatak yok; fethetmenin tek
getirisi taban gelir (`0.4/sn`) ve nüfus. Harita kararı ekonomik olarak
neredeyse anlamsız.

**Ne:** yatak *türü* eklemeden karakter verilir — ova / dağ / liman / nehir —
ve bu karakter mevcut sektör kapasitelerini çarpanla ayırır (ova → tarım,
dağ → çıkarma, liman → ticaret/lojistik, nehir → enerji + tarım).

**Neden en sona:** 1-3 zinciri sağlamlaştırır; karakter çarpanları sağlam
olmayan bir zincire uygulanırsa etkisi ölçülemez.

**Kabul ölçütü:**
- özelliksiz şehir sayısı 118 → belirgin şekilde düşer
- karakter dağılımı coğrafyayla tutarlı (dağ maskesi, kıyı mesafesi)
- AI'nın hedef seçimi (`StoryAI.js:179` düğüm değeri) karakteri okur

---

## Ortak kapılar (her aşamada)

| kapı | ne kanıtlar |
|---|---|
| `--forktest` | canlı ↔ replay sapması yok |
| `--uitest` | arayüz akışı kırılmadı |
| aynı tohumda taban ölçümü | ekonomi göstergeleri istenmeyen yönde kaymadı |
| kayıt yükleme | eski kampanyalar açılıyor |
| negatif kontrol | ölçüm aleti değişikliği gerçekten yakalıyor |

> **Ölçüm tuzağı uyarısı.** Bu turda alet dört kez yanılttı (sabitlenmemiş
> tohum, ölçüm sırasında ilerleyen dünya, `scrollWidth`'i kirleten pseudo-eleman,
> saniyede bir güncellenen panelden okunan bayat değer). Bir bulgu kodu
> suçlamadan önce **aletin o bulguyu üretebildiği gösterilmeli**.
> Ayrıntı: `docs/OLCUM-TUZAKLARI.md`, `mockup/BULGULAR.md`.
