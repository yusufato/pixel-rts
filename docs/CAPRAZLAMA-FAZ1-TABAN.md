# FAZ 1 — Taban haritası ve kontrol

Tarih: 2026-08-05 · Plan: [PLAN-KONUSLANDIRMA-CAPRAZLAMA.md](PLAN-KONUSLANDIRMA-CAPRAZLAMA.md)
Kapılar: `--recipebase`, `--recipeab`

---

## 1. R0 — mevcut AI'ın fiili kompozisyonu (6 tohum ortalaması, 6500₺)

| kategori | R0-saldıran | R0-savunan |
|---|---|---|
| infantry | %30.9 | %37.3 |
| **armor** | **%25.6** | **%25.5** |
| support | %10.8 | %11.1 |
| indirect | %7.5 | %8.7 |
| air_defense | %7.2 | %4.7 |
| recon | %5.1 | %6.5 |
| uav | %4.9 | %2.3 |
| **air** | **%4.2** | **%0.0** |
| logistics | %3.9 | %3.9 |

Ortalama harcanan: saldıran 6455₺, savunan 6437₺ (yani **~50₺ sürekli harcanmıyor**).

İki rol neredeyse **aynı orduyu** alıyor — armor %25.6 vs %25.5, support %10.8 vs %11.1.
Savunanın tek belirgin farkı: daha çok piyade (+%6.4), **hiç hava yok** (%4.2 → %0) ve daha az AA.

## 2. RU — kullanıcının kendi kompozisyonları (aynı birimle ölçüldü)

| kategori | K2024-DOĞRU | K777 | ← R0-saldıran |
|---|---|---|---|
| infantry | %31.9 | %35.2 | %30.9 |
| **indirect** | **%13.9** | %10.0 | %7.5 |
| support | %12.9 | **%20.4** | %10.8 |
| **air** | **%12.3** | %0.0 | %4.2 |
| air_defense | %9.2 | %4.6 | %7.2 |
| recon | %8.3 | %8.3 | %5.1 |
| **armor** | **%7.7** | %17.6 | **%25.6** |
| logistics | %3.9 | %3.9 | %3.9 |

**En büyük ayrım ZIRH:** AI %25.6, kullanıcı %7.7–17.6. Kullanıcı zırhtan kestiğini
dolaylıya, havaya, keşfe ve desteğe koyuyor. (K2024-kesifsiz 5960₺ — kullanıcının
sonradan hatırladığı 3 keşif aracı eksik hâli; K2024-DOĞRU tam 6500₺.)

## 3. Kullanıcının kompozisyonu AI komutasında KÖTÜ

3×3 çapraz (3 tohum, iki taraf da intel4, pro-delta yok → tek değişken kompozisyon):

| saldıran \ savunan | R0-savunan | RU-K2024 | RU-K777 |
|---|---|---|---|
| **R0-saldıran** | 2/3 +213 | 3/3 +3702 | 3/3 +3533 |
| **RU-K2024** | 0/3 −3437 | 0/3 −2197 | 0/3 −4209 |
| **RU-K777** | 0/3 −2669 | 3/3 +3621 | 0/3 −4069 |

Kullanıcının orduları AI'ın elinde 0/9 ve 3/9. Bu, daha önceki bulguyla **tutarlı**:
insan-AI farkı kompozisyon değil **komuta** (insan 2.7× verimli, fark yerel üstünlük).
Ateş-merkezli bir orduyu ancak ateş-merkezli komuta eder; AI'ın doktrini zırh-ağır orduya göre.
→ Bu bir kompozisyon hükmü DEĞİL, kompozisyon×komuta etkileşimidir. FAZ 4'te yeniden bakılacak.

## 4. ⭐ ANA BULGU — kompozisyon tek başına saldıranı 0/6'dan 4/6'ya çıkarıyor

Ayrıştırma çaprazı (6 tohum, `H0-sezgisel` = mevcut sezgisel üretici, `R0-*` = onun 6-tohum ortalaması):

| saldıran \ savunan | R0-savunan | H0-sezgisel |
|---|---|---|
| **R0-saldıran** | 4/6 **+337** | **4/6 +447** |
| **H0-sezgisel** | 5/6 +1831 | **0/6 −3611** |

- Sağ-alt hücre (**0/6**) daha önceki kontrol koşusunu **birebir yeniden üretiyor** → tezgâh tutarlı.
- Sol-üst/sağ-üst: aynı sezgisel savunana karşı, **ortalanmış kompozisyon 0/6 yerine 4/6 alıyor.**
  Beyin aynı, yerleşim geometrisi aynı, bütçe aynı, tohumlar aynı. **Değişen tek şey ordu.**

Yani "saldıran eşit bütçede kazanamaz" bir motor yasası değil, **kompozisyon arızasıymış.**

### Uyarılar (bu sayıyı olduğundan büyük okumayın)
1. **R0-tarif ≠ mevcut AI.** R0, 6 tohumun ORTALAMASI; sezgisel üretici her tohumda farklı ordu
   kuruyor. Kazanç, "hangi paylar doğru" kadar "tohumdan tohuma savrulmamak"tan da geliyor olabilir —
   ikisini FAZ 2 ayıracak.
2. **Tarif yolu sezgiselleri atlıyor** (imza-floor, SAM/radar takasları, sert tabanlar, mızrak, artık).
   Kazanç bu kısıtların kalkmasından da geliyor olabilir.
3. **Bütçe farkı 130₺** (R0 6500 harcıyor, H0 6370) — %2. Gerçek ama 0/6→4/6'yı açıklamaz.
4. Ters yön de doğru: **R0-savunan KÖTÜ bir savunan** (3/12), H0-savunan iyi (8/12). Ortalamak
   saldırana yarıyor, savunana zarar veriyor. Rol-başına ayrı tarif şart.

---

## 5. FAZ 1 çıktıları

- `qa-runtime/tarifler-taban.json` — R0-attacker, R0-defender, RU-K2024-DOGRU, RU-K2024-kesifsiz,
  RU-K777, H0-sezgisel (sezgisel üreticiyi çaprazda rakip yapan kanca)
- `qa-runtime/recipe-ab.json` — hücre detayları (maç başına kazanan/sebep/marj/erken pencere)

## 6. FAZ 2 için keskinleşen hipotezler

Ön-kayıtlı (plan §4) hipotezler taban haritasıyla güncellendi:

- **H3′ (yükseltildi):** saldıranda `armor` payı ↓ + `indirect`/`air`/`recon` ↑ → saldıran kazanır.
  Gerekçe: kullanıcı (2.7× verimli) zırhı %7.7'de tutuyor, AI %25.6'da; ve ortalanmış ordu 4/6 alıyor.
- **H5 (yeni):** kazancın kaynağı payların kendisi değil **tohumdan tohuma savrulmama** olabilir →
  sezgisel üreticiyi `varied` kapalı koşup ayır.
- H1/H2 (savunanda infantry↑ / support↑ → siperlenme↑) FAZ 4'e taşındı; savunan tarafta
  ortalamak zarar verdiği için önce saldıran çözülecek (kapının tavanı orada).
