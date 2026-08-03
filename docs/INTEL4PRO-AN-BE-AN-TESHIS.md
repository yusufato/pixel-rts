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

### P1 — Savunan için MÜHİMMAT DİSİPLİNİ (ana iş)
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
