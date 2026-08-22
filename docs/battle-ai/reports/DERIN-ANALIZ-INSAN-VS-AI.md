# Derin analiz — insan vs AI, 6 canlı maç (2026-08-08)

Kullanıcının güncel motorda `intel4-pro`'ya karşı oynadığı 6 maçın **ham kaydının tamamı**
incelendi. Önceki tarama (`tools/fark-taramasi.js`) yalnız `samples[]` üzerinden 23 ortalama
çıkarıyordu; kullanıcı haklı olarak "çok az veriyi inceledin" dedi. Bu belge
`controllerDecisions` (dosya başına 4.5 MB, **hiç kullanılmamıştı**) dâhil 8 katmanın sonucudur.

Araç: `tools/derin-analiz.js` (`--katman 1..8`).

Tohumlar: 3763424710, 3763764732, 3764669464, 3765085522, 3766078712, 3766439452.
AI hep kırmızı, rakip beyin `intel4-pro`. 4 maçta insan saldıran, 2 maçta AI saldıran.

---

## Çürüyen iki iddia (aynı gün, ölçümden önce söylenmişti)

**1. "AI düşmanı 6500 (tam bütçe) sanıyor, istihbarat kör."** — YANLIŞ.

| maç ilerlemesi | sandığı | gözlediği | GERÇEK | oran-sandığı | oran-gerçek |
|---|---|---|---|---|---|
| %10 | 6303 | 896 | — | 1.00 | — |
| %50 | 5353 | 2272 | **5112** | 0.67 | **0.68** |
| %90 | 4276 | 1662 | **3976** | 0.26 | **0.26** |

Kuvvet oranı sapması ortalama **0.01**, mutlak sapma **0.07**. İstihbarat tabanına yapışık karar
%95 — ama taban *doğru çıkıyor*, çünkü insanın ordusu gerçekten ayakta kalıyor. Düşmanı abartma
%1, küçümseme %7.

**Yine de gerçek olan:** kararların **%35'i sıfır görünür kontakla** alınıyor.

**2. "AI etkili menzilini bırakıp yaklaşıyor; müdahale = menzilde kal."** — ÇÜRÜDÜ.

Uzun menzilli (≥10 kare) birimlerin duruşu iki tarafta **aynı**:

| | örnek | en yakın düşman | etkili menzil | düşman/menzil | baskı |
|---|---|---|---|---|---|
| insan | 13399 | 1431 | 1285 | **1.2** | **1.2** |
| AI | 9167 | 1179 | 1052 | **1.2** | **7.6** |

Kendi menzilinin yarısından yakında duran ("boşuna öne çıkmış") uzun menzilli: insan %7, AI %8.
**Duruş aynı, ama AI 6× baskı yiyor** — sebep mesafe değil.

---

## Ölçülen asıl fark: hasarın kaynağı

| İNSANIN çıktısı | pay | | AI'ın çıktısı | pay |
|---|---|---|---|---|
| attack_helo | %17 | | **tank_destroyer** | **%23** |
| tank_destroyer | %15 | | **at_team** | **%22** |
| loitering_munition | %14 | | spaag | %13 |
| mlrs | %11 | | artillery | %8 |
| commando | %11 | | loitering_munition | %7 |
| spaag | %10 | | manpads_team | %7 |
| ballistic_missile | %8 | | mbt | %6 |
| artillery | %6 | | mortar_team | %3 |

İnsanın hasarı **8 sisteme yayılmış** (%6-17). AI'ın hasarının **%45'i iki tanksavar
sisteminden** (24 at_team + 6 tank_destroyer ≈ 6600₺) — oysa insan ordusunda zırh bütçenin **%8'i**.

İnsanın gerçek hasarı **hava** (%33: helo + loitering + SİHA) ve **dolaylı** (%25: mlrs + balistik
+ topçu). AI'ın hava cevabı (spaag/manpads) çoğunlukla **loitering munition düşürüyor** — yani
insanın ucuz sarf malzemesini.

**Sonuç: AI 47.506 hasar yiyor, insan 17.280 (2.75×).**

Menzil sınıfına göre verim (verdiği/yediği):

| | UZUN | orta | kısa |
|---|---|---|---|
| insan | **6.54** (hasarın %70'i) | 1.51 | 0.14 |
| AI | **0.63** (hasarın %39'u) | 0.51 | 0.06 |

AI'ın uzun menzilli birimleri **verdiğinden fazlasını yiyor**.

---

## Hareket eğrisi (kullanıcının hipotezi — kısmen doğru)

| maç dilimi | %10 | %30 | %50 | %70 | %90 |
|---|---|---|---|---|---|
| İNSAN hareket | %3.7 | %5.1 | %4.0 | %14.3 | %14.4 |
| AI hareket | **%63** | %41 | %34 | %26 | %15 |
| canlı (ins/AI) | 18.4/28.8 | 17.5/25.0 | 16.3/19.1 | 15.1/12.2 | 13.7/7.3 |

İnsan yerleşip bekliyor, sonra hareketleniyor. AI tersi: başta koşuşturup sonra duruyor
(çünkü eriyor). Eşlik eden:

- plan çalkantısı **5.8 değişim/maç** (1.71/dk)
- **dakikada 25.8 hedef sıçraması** (3 sn içinde >300px hedef değişimi, ort. 578px)
- birim başına **41.6 emir**
- taarruz kapısı yalnız %13 açık; duruş dağılımı PRESERVE %55, SHAPE %24, STRIKE %13

Yorum: hareket **kök neden değil semptom** — ordu yanlış kurulunca doğru mesafede durmak da
kazandırmıyor, o yüzden sürekli yer değiştiriyor.

## Ölüm bağlamı

| kurban | ölüm | öldüğü mesafe | YALNIZ (dost≤1) | KÜTLE (dost≥4) | arka/kanat |
|---|---|---|---|---|---|
| İNSAN | 42 | 517px | %43 | %33 | %26 |
| AI | 186 | 720px | %28 | **%49** | %32 |

İnsan **uzaktan** öldürüyor (720px), AI **yakından** (517px). AI ölümlerinin yarısı kütle içinde.

250px çemberinde yığılma: insan ort. 1.9 komşu, AI 2.6 (tepe 4.4 vs 4.9) — AI daha yığın ama
"yumak" değil.

---

## Ölçülemeyen / geçersiz sayılan

- **AoE hasar payı**: sınıflandırıcı çok geniş (neredeyse her silahın `aoe` veya `indirect`
  alanı var) → insan %95, AI %99 çıktı. Ölçü kör, kullanılmadı.
- **Maç sonu net-maruziyet dönüşü** (son %30'da AI lehine görünüyor): hayatta-kalma yanlılığı —
  AI 3.9 birime düşmüş, kalanlar saklanıyor. Anlamsız.
- **Menzil sınıfı bütçe payı** maç başına oynak (AI'ın uzun menzil payı bir maçta insanınkinden
  yüksekti ve yine kaybetti) → tek başına açıklayıcı değil.

## Yapısal kısıt

`battleBuildArmyManifest(rawBudget, config)` — **düşman parametresi yok**. AI ordusunu kör kurar
(doktrin ağırlıkları + tohum gürültüsü). Maç içi takviye satın alma yok. Yani AI **karşı-ordu
kuramaz**; insan ise maçlar arası öğrenip uyarlıyor. Aynı bütçeyle insan 110 birim, AI 177 birim
alıyor (6 maç toplamı, ~6470₺/maç eşit).

---

## Bunun üzerine kurulan deney

`tools/ordu-takasi.js` — **aynı kod-AI iki tarafta, tek değişken bileşim**. İnsanın 6 ordusu
tarife (`BATTLE_RECIPE_RED` / `recipe`) çevrilip AI'a sürüldü. Karar kuralı: insan kompozisyonunun
saf avantajı |t| < 2 ise **tedarik kaldıraç değildir** ve yön yürütmeye döner.

Sonuç için bkz. aşağısı / `qa-runtime/insan-ordulari.json`.
