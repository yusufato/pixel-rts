# Handikap kanıtı: insan −%32 bütçeyle AI'ı yendi

**Maç:** seed 3454944363, 2026-08-04 21:07 · mavi = insan (saldıran), kırmızı = intel4 AI (savunan)
**Bütçe: insan 4410₺ · AI 6460₺ → −2050₺ (%32 handikap)**
**Sonuç: `attacker_dominant`, insan kazandı** (bitişte değer 2600 vs 1760; öldürme 23-12)

## Değer eğrisi — açık nasıl kapandı

| sn | insan | AI | fark |
|---|---|---|---|
| 0 | 4410 | 6460 | **−2050** |
| 30 | 4410 | 5510 | −1100 |
| 90 | 3610 | 5320 | −1710 |
| 180 | 3090 | 4400 | −1310 |
| 240 | 3270 | 3660 | −390 |
| **270** | 3090 | 2710 | **+380** |
| 360 | 2600 | 1760 | **+840** |

İlk 30 saniyede AI **950₺** kaybetti, insan **sıfır**. Savunanın ilk atışı **t=36.6sn** —
o ana kadar insan **1710 hasarı bedava** verdi.

## Ölçülen fark

| metrik | İNSAN | AI |
|---|---|---|
| **verim** (hasar / kaybedilen₺) | **3.96** | **0.60** → insan **6.6×** |
| yerel kuvvet oranı (vurulurken 600px) | **4.55** (8.0 dost / 1.8 düşman) | 2.21 |
| **mühimmat rotasyonu** | **8** | **0** |
| APM | 62.2 komut/dk | — |
| komut kırılımı | **339 hareket / 25 saldırı / 9 yetenek** → %91 KONUMLANDIRMA | — |

**Hasar kaynağı:** Havan ×3 **2717** · Taarruz Helo **1866** · ÇNRA **1388** · Kamikaze 800.
Dolaylı ateş tek başına hasarın **%57'si** — 16 birimlik orduda 3 havan + 1 ÇNRA.

Rotasyon örnekleri: havanlar **ikişer kez** kuruyup doldu (t=175→194, t=298→307);
çoğu **0px yer değiştirerek** (ikmal onlara geldi). AI'ın rotasyonu yine **0**.

## Sonuç
Üç bağımsız kanıt aynı yeri gösteriyor:
1. İnsan, AI'ın **kendi ordusuyla** oynayıp 12-2 kazandı (kadro değil komuta).
2. İnsanın kadrosu AI'ın elinde 4/6 vs 2/6 (kadro katkı sağlıyor ama komutayı kurtarmıyor).
3. **İnsan −%32 bütçeyle kazandı ve 6.6× verim çıkardı.**

Ve karar *hacmi* açıklama değil: AI aynı maçlarda ~1050-1100 controller-order üretiyor,
insan 373 komut veriyor. **Sorun emir sayısı değil, emrin içeriği** — özellikle konumlandırma (%91).

**intel4-pro için sıralama:** (a) mühimmat rotasyonu (8 vs 0, en net ve en ucuz kazanç),
(b) yerel üstünlük kurma (schwerpunkt), (c) dolaylı ateşin gözcü+kütle ekonomisi.
