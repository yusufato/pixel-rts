# ⚠ ÖLÇÜM KRİZİ — "saldıran 0/6" GERİ ÇEKİLDİ, tohum sayısı yetersizmiş

Tarih: 2026-08-05 · Bu belge önceki üç belgenin sonuçlarını **düzeltir**:
[SAVUNAN-BOLGE-TUTMA.md](SAVUNAN-BOLGE-TUTMA.md) · [KUVVET-ORANI-DUZELTME-SONUC.md](KUVVET-ORANI-DUZELTME-SONUC.md) ·
[CAPRAZLAMA-FAZ1-TABAN.md](CAPRAZLAMA-FAZ1-TABAN.md)

---

## 1. Ne oldu

FAZ 2'nin kazananını (`S-recon-dus`, 6 tohumda 6/6) **ölçümde kullanılmayan tohumlarda** sınadım:

| tarif | tohum kümesi A (2024,777,909,3141,2718,5150) | tohum kümesi B (111,222,333,444,555,666) |
|---|---|---|
| S0-taban | 4/6 (+947) | **1/6 (−1432)** |
| S-recon-dus | **6/6 (+3277)** | **2/6 (−925)** |

Kazanan transfer etmedi. Bunun üzerine **kontrolü** taze tohumlarda koştum:

| kontrol (iki taraf da mevcut sezgisel AI) | sonuç |
|---|---|
| kümе A | saldıran **0/6** |
| küme B | saldıran **5/6** |

## 2. Gerçek taban: 24 tohum

`H0-sezgisel` vs `H0-sezgisel`, 6500₺ eşit, 24 tohum:

```
SALDIRAN 10/24 (%42)   ort. marj −688   marj STD SAPMA 3114
s2024:v s777:v s909:v s3141:v s2718:v s5150:v s111:S s222:S s333:S s444:v s555:S
s666:S s1234:v s4321:S s8080:v s6060:v s7:v s42:S s99:S s1001:v s2222:v s3333:v s4444:S s5555:S
```

**Saldıran %42 kazanıyor** — hafif dezavantajlı, ama "hiç kazanamaz" DEĞİL.
İlk altı tohumun altısı da savunan-galibiyeti çıkmış (p≈%3.8), sonraki altıda beşi
saldıran çıkmış (p≈%4.5). İki uç örneklem üst üste geldi.

## 3. GERİ ÇEKİLEN İDDİALAR

| iddia | durum |
|---|---|
| "Saldıran eşit bütçede **0/6** kaybediyor, yapısal" | **YANLIŞ** — 24 tohumda %42 |
| "Mezuniyet kapısının tavanı %50, %75 imkânsız" | **YANLIŞ** — dayandığı öncül çürüdü |
| "Kompozisyon saldıranı 0/6'dan 4/6'ya çıkarıyor" | **DESTEKSİZ** — 0/6 tabanı tohum artefaktıydı; taze tohumda R0 1/6 |
| "S-recon-dus kazandırıyor (6/6)" | **DESTEKSİZ** — taze tohumda 2/6 |
| "`holdZone` savunanı 6/6'dan 4/6'ya düşürüyor" | **ŞÜPHELİ** — aynı 6 tohumla ölçüldü, yeniden ölçülmeli |
| "`trueForceRatio` eşit bütçede nötr (2/6 vs 3/6)" | **ŞÜPHELİ** — 3 tohum, aynı sebep |

Ayakta kalanlar (tohumdan bağımsız, mekanizma ölçümleri):
- `forceRatio` formül hatası ve düzeltmesi (t0 oranı 1.00 → 1.46; **aritmetik**, istatistik değil)
- Savunanın emredilen hattının derinlik ~1.04'te olması (kod okuması + 6/6 sürüklenme ölçümü)
- Siperlenebilen ₺ payının %0–30 olması (kompozisyon ölçümü)
- Bütçe kaçağı 560₺ (aritmetik)
- Tarif çözücüsündeki sıfır-ağırlık hatası (aritmetik)
- Taban kompozisyon haritası R0/RU (ölçüm, maç sonucu değil)

## 4. Kök neden: gürültü, ve kaç tohum gerektiği

Marj standart sapması **3114**. Ortalama marj için:

| istenen hassasiyet | gereken tohum (%95 güven) |
|---|---|
| ±2000 | ~10 |
| ±1500 | ~17 |
| ±1000 | ~37 |
| ±500 | ~150 |

**Eşleştirme (aynı tohumda A/B) YARDIM ETMİYOR.** S0 ↔ S-recon-dus eşleştirilmiş
farkların std sapması ~3400 — ham marjınkinden bile büyük. Sebep: simülasyon kaotik;
**tek birimlik değişiklik muharebeyi baştan aşağı başka bir yola sokuyor.** "Aynı tohum"
aynı muharebeyi vermiyor, yalnız aynı haritayı veriyor.

Yani 3 tohumluk tarama ve 6 tohumluk doğrulama **istatistiksel olarak anlamsızdı**.
Bugüne kadarki tüm 3-6 tohumluk A/B kararları bu kusuru taşıyor.

## 5. Planın revizyonu (PLAN-KONUSLANDIRMA-CAPRAZLAMA.md yerine geçer)

### 5.1 Kabul eşikleri
- **Tarama:** 12 tohum; yalnız |Δmarj| > 1800 olan eksenler ilerler (2σ/√12).
- **Doğrulama:** 48 tohum, ve **doğrulama tohumları taramada KULLANILMAZ** (dışörneklem).
- Her iddia **tohum kümesiyle birlikte** raporlanır. "4/6" tek başına bir sonuç değildir.
- Kontrol hücresi her koşuda aynı tohum kümesinde koşulur.

### 5.2 Maliyet ve paralelleştirme
Makine: **16 çekirdek / 17GB**. Tek maç ≈40sn.
- 6×6 turnuva × 48 tohum = 1728 maç ≈ 19 saat seri.
- 8 paralel süreçle ≈ **2.5 saat**. Paralel koşucu (süreç başına tohum dilimi) FAZ 0.5 olarak eklenir.
- Determinizm paralelleştirmeden etkilenmez (her süreç kendi başsız oturumu).

### 5.3 Gürültü azaltma (araştırılacak)
- Sonuç metriği olarak yalnız son-durum marjı değil, **maç boyu marj integrali** (daha az kaotik olabilir).
- Aynı tarif çifti için **rol değişimi** (A saldıran/B savunan ve tersi) → taraf yanlılığı sadeleşir.
- Birim-vs-birim **karşılık matrisi**: küçük kontrollü düellolar tam maçtan çok daha az gürültülüdür;
  ordu bileşimi bu matristen türetilip yalnız finalistler tam maçla sınanır.

## 6. Ders

Kaotik bir simülasyonda **ölçüm gücü, arama gücünden önce gelir.** Milyonlarca kombinasyon
denemek, değerlendirme ±3000 gürültülüyse yalnız gürültüye aşırı-uyum üretir — nitekim
"6/6 kazanan" tarif taze tohumda 2/6 çıktı. Önce kaç tohumun bir kararı taşıdığını ölç,
sonra ara.
