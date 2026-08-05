# FAZ 2 — Saldıran kompozisyon süpürmesi (üç havuzlu, doğrulanmış)

Tarih: 2026-08-05 · Plan: [PLAN-KONUSLANDIRMA-CAPRAZLAMA.md](PLAN-KONUSLANDIRMA-CAPRAZLAMA.md)
Ölçüm disiplini: [OLCUM-KRIZI-TOHUM-SAYISI.md](OLCUM-KRIZI-TOHUM-SAYISI.md) · Tezgâh: [TEZGAH-JSDOM.md](TEZGAH-JSDOM.md)

Toplam **1128 maç**, üç ayrık tohum havuzu, 12 paralel işçi, ~20 dakika.

---

## 0. Yöntem

Rakip her yerde sabit: **H0-sezgisel** (mevcut AI'ın kendi konuşlandırıcısı). İki taraf da
intel4 beyni, pro-delta yok → **tek değişken kompozisyon**. Bütçe 6500₺ eşit.

| aşama | havuz | tohum | amaç |
|---|---|---|---|
| 1. tarama | TARAMA | 24 | 18 eksen × ±%50 süpürme |
| 2. dışörneklem | DIŞÖRNEK | 48 | tarama kazananlarını sına |
| 3. final | FİNAL | 48 | **hiçbir seçim kararında kullanılmadı** — birleşimlerin nihai sınavı |

## 1. Tarama (24 tohum, 456 maç)

Anlamlı (%95 GA sıfırı içermiyor): `support↑` **+1209 ±792** (18/24) ve
`air_defense↑` **−1182 ±1021** (6/24). Taban `S0` 9/24, −559.

**Kör eksenler** (kadro tabanla birebir aynı → ölçülmemiş sayılır):
`air↓`, `indirect↓`, `logistics↓`. Küçük kategorilerde ±%50 tam sayı kadroyu değiştirmiyor.

## 2. Dışörneklem (48 tohum, 336 maç) — ve bir SAHTE POZİTİF

| tarif | tarama | dışörneklem |
|---|---|---|
| S0-taban | 9/24, −559 | 26/48, +112 |
| **support↑** | **18/24, +1209 (anlamlı)** | **22/48, −364** ← ÇÖKTÜ |
| armor↑ | 17/24, +818 | 30/48, +625 |
| logistics↑ | 14/24, +413 | 32/48, +680 |
| recon↓ | 15/24, +291 | 31/48, +887 (anlamlı) |
| armor↓ | 15/24, +437 | 25/48, −181 |
| air_defense↑ | 6/24, −1182 (anlamlı) | 18/48, −875 (anlamlı) |

Taramanın **tek anlamlı kazananı dışörneklemde çöktü.** 18 varyant sınandığında %5 eşikle
beklenen sahte pozitif tam olarak budur. Dışörneklem adımı olmasaydı `support↑` "bulgu"
diye raporlanacaktı — bu adım pazarlık konusu değil.

İşareti iki havuzda da tutan eksenler: **armor↑, logistics↑, recon↓** (ve robust negatif:
**air_defense↑ iki havuzda da anlamlı kötü**).

## 3. Final havuz (48 taze tohum, 336 maç) — NİHAİ SONUÇ

Birleşim tarifleri, R0-attacker tabanından türetildi (eksen ×1.5 / ×0.5, kalanlar orantılı
yeniden normalize). Bu havuz hiçbir seçim kararında kullanılmadı.

| tarif | galibiyet | marj ±%95 |
|---|---|---|
| S0-taban (kontrol) | 21/48 | −384 ±802 |
| B3-keşif↓ | 30/48 | +146 ±819 |
| B2-lojistik↑ | 27/48 | +451 ±832 |
| B5-zırh+keşif | 31/48 | +684 ±753 |
| B1-zırh↑ | 31/48 | **+756 ±704 (anlamlı)** |
| **B4-zırh+lojistik** | **34/48** | **+1202 ±709 (anlamlı)** |
| B6-üçlü (zırh+lojistik+keşif) | 34/48 | +1202 ±709 — **B4 ile birebir aynı** |

**B6 = B4:** keşif↓ eklemek bu birleşimde kadroyu hiç değiştirmiyor (kör eksen). Yani
kazanç iki eksenden geliyor: **zırh↑ + lojistik↑**.

### Kabul edilen bulgu
`armor %25.6 → %38.3` ve `logistics %3.9 → %5.8` (kalanlar orantılı azalır):
**21/48 → 34/48, marj −384 → +1202.** Fark +13 galibiyet, +1586 marj; %95 GA sıfırın üstünde.

## 4. Mekanizma — kadro ne değişti

| | S0-taban (29 birim) | B4 kazanan (27 birim) |
|---|---|---|
| Tank / ZMA / Tank Avcısı | 2 / 1 / 1 | 2 / **2** / **2** |
| İkmal Aracı | 1 | **2** |
| Tanksavar Timi | 3 | **2** |
| Havan Timi | 2 | **1** |
| SPAAG | 2 | **1** |
| Keşif Aracı | 2 | **1** |
| Sağlıkçı | 2 | **1** |

Yani: **daha ağır zırhlı mızrak + ikinci ikmal aracı**, karşılığında bir tanksavar, bir havan,
bir SPAAG, bir keşif ve bir sağlıkçı. Kullanıcının çok önce söylediğiyle örtüşüyor:
*"7 tanksavar fazla, 3-4 yeter, kalan parayı daha iyi değerlendir."* Ölçüm de tanksavarı
azaltıp parayı zırha kaydırmayı ödüllendiriyor.

Not: bu, kullanıcının KENDİ ordusunun (zırh %7.7) tersi yönde. Çelişki değil — daha önce
ölçülmüştü ki insanın üstünlüğü kompozisyon değil **komuta**; AI'ın doktrini zırh-ağır orduyu
daha iyi kullanıyor.

## 5. Açık uçlar

- Kör eksenler (`air↓`, `indirect↓`, `logistics↓` taramada) hiç ölçülmedi → daha büyük
  çarpanla (×0.25 / ×2.0) yeniden süpürülmeli.
- `air_defense↑` iki havuzda da anlamlı kötü çıktı; **düşürmek** ayrıca sınanmadı.
- Bu bulgu yalnız **saldıran** rolü ve yalnız **H0-sezgisel savunana karşı**. Savunan rolü
  ve arketip×arketip turnuvası (FAZ 3) hâlâ açık.
- Kazanç eşiği: mezuniyet kapısı koşulmadı (kullanıcı söyleyince koşulacak).
