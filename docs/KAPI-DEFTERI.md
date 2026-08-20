# KAPI DEFTERİ — bütün maç kapılarının sonucu tek yerde

**Bu dosya ÜRETİLİR, elle yazılmaz.** Yeniden üretmek için:

```

KAPI ÖZETİ — gece-faz2.log, gece-gpu.log, gece-kapi.log, gece-stdout.log

  kapı                                              n    fark    std      t  taban  hüküm
  ──────────────────────────────────────────────────────────────────────────────────────────────
  H1: LA_DERIN 2 vs 5 (oynatilan aday sayisi)     128     656   3052   2.43    755  olculemedi
  H2: LA_KAPI_CARPAN 1 vs 0.25 (yayilim kapisi    128     330   2827   1.32    700  olculemedi
  H3: LA_UFUK 100 vs 200 (taze tohum, havuz ici   128     874   3164   3.13    783  GECTI (+)
  K0: karsi-batarya MEKANIZMA (maviye 3 topcu z     —       —      —      —      —  A/B degil
  K1: BATTLE_KARSI_BATARYA_HERKES kapali vs aci   128     -32    366  -0.98     90  ETKI YOK
  M0: MENZILE GIR mekanizma                         —       —      —      —      —  A/B degil
  M1: BATTLE_MENZILE_GIR kapali vs acik (mac ka   128     748   3101   2.73    768  olculemedi
  U0: ufuk maliyeti 100/200/300 (bos makinede)      —       —      —      —      —  A/B degil
  K0b: karsi-batarya MEKANIZMA (duzeltilmis)        —       —      —      —      —  A/B degil
  H1b: LA_DERIN 2 vs 5 DOGRULAMA (taze tohum, h   128     557   3114   2.02    771  olculemedi
  H4: LA_UFUK 200 vs 300 (kazanani zorla)         128     980   3273   3.39    810  GECTI (+)
  P1: LA_PERIYOT_TIK 100 vs 50 (karar sikligi,    128    -808   3164  -2.89    783  GECTI (-)
  P2: LA_HALKA 3 vs 5 (aday genisligi 24->40)     128    -299   2689  -1.26    666  olculemedi
  C3: LA_KABA_ADIM 1 vs 4 (20Hz vs 5Hz rollout)   128   -2390   2963  -9.13    733  GECTI (-)
  C5: LA_AG_KAPI true vs false (aday siralamasi   128     812   2315   3.97    573  GECTI (+)
  C4: LA_PERIYOT_TIK 100 vs 50 @ tam guc (karar   128    -508   2409  -2.38    596  olculemedi
  C2b: LA_DERIN 2 vs 5 @ ufuk 300 (toplanma var     —       —      —      —      —  suruyor
  B: arama taban (arama kapali vs acik)           192     735   2872   3.55    580  GECTI (+)
  C: emir omru koruma 0 vs 1 (yalniz MOVE)        192     552   2812   2.72    568  olculemedi
  D: ufuk 100 vs 200 tik (5sn vs 10sn)            128     357   3009   1.34    745  olculemedi
  E: emir omru koruma 0 vs 15 DOGRULAMA (taze t   192     277   3415   1.12    690  olculemedi
  F: koruma 0 vs 1 DOGRULAMA (taze tohum 100192   192      64   3051   0.29    617  olculemedi
  G: koruma 1 vs 15 DOGRUDAN (taze tohum 100384     —       —      —      —      —  A/B degil
  H: LA_DERIN 2 vs 5 (oynatilan aday sayisi) —      —       —      —      —      —  A/B degil

  GECTI = |fark| saptama tabanının üstünde (karar verilebilir)
  ETKI YOK = taban altı VE std çok küçük → kol dünyayı kıpırdatmıyor (güvenle hayır)
  olculemedi = taban altı ama std normal → bu n ile GÖREMİYORUZ (etkisiz DEMEK DEĞİL)

  ═══ HAVUZ (ters-varyans) ═══
    LA_DERIN 2,5: n 256  havuz 607  se 193  t 3.15  taban 540  → TABANIN USTUNDE
    LA_UFUK 100,200: n 256  havuz 603  se 193  t 3.13  taban 540  → TABANIN USTUNDE
    LA_PERIYOT_TIK 100,50: n 256  havuz -618  se 169  t -3.65  taban 488  → TABANIN USTUNDE
    BATTLE_LA_EMIR_KORUMA 0,1: n 384  havuz 328  se 149  t 2.20  taban 419  → taban alti

```

## Makine 2 kapıları (docs/kayit-m2/m2.log)

```

KAPI ÖZETİ — m2.log

  kapı                                              n    fark    std      t  taban  hüküm
  ──────────────────────────────────────────────────────────────────────────────────────────────
  M2-1: BATTLE_MENZILE_GIR false vs true (M1 te   128    1222   3229   4.28    799  GECTI (+)
  M2-2: LA_PERIYOT_TIK 100 vs 50 @ tam guc        128    -687   2474  -3.14    612  GECTI (-)
  M2-3: LA_DERIN 2 vs 5 @ ufuk 300                128     954   2667   4.05    660  GECTI (+)
  M2-4: BATTLE_TOPCU_DURAGAN false vs true @ ta   128     349   2105   1.87    521  olculemedi
  M2-5: LA_UFUK 300 vs 400 @ derin 5 (ufuk hala   128     440   2131   2.34    527  olculemedi
  M2-6: LA_AG_KAPI true vs false @ tam guc (C5    128     976   2229   4.96    552  GECTI (+)
  M2-7: LA_HALKA 3 vs 5 @ tam guc (aday genisli   128    -189   2587  -0.83    640  olculemedi
  M2-8: LA_YARICAP 600 vs 900 @ tam guc (aday e     —       —      —      —      —  suruyor

  GECTI = |fark| saptama tabanının üstünde (karar verilebilir)
  ETKI YOK = taban altı VE std çok küçük → kol dünyayı kıpırdatmıyor (güvenle hayır)
  olculemedi = taban altı ama std normal → bu n ile GÖREMİYORUZ (etkisiz DEMEK DEĞİL)

```


---

## T1 — TOPÇU ATEŞ DİSİPLİNİ (2026-08-20, bu makine) · **SEVK YOK**

`BATTLE_TOPCU_DURAGAN false vs true @ tam güç`, n=128, tohum 123000-123127, 396 dk.

| kol | maç | saldıran% | marjOrt | marjStd | t |
|---|---|---|---|---|---|
| false | 128 | %87,5 | 2317 | 1720 | 15,24 |
| true | 128 | **%93,8** | 2635 | 1392 | 21,42 |

Eşleştirilmiş fark **+318**, std 1319, t 2,73 · **saptama tabanı 326** → **8 puanla altında.**

### ⚠ HAVUZLAMA DENENDİ VE GERİ ÇEKİLDİ

M2-4 aynı soruyu ayrık tohumda ölçmüştü (+349, std 2105, taban 521). Ters-varyans
havuzlaması **+327 vs taban 277** veriyor, yani "geçti" görünüyordu. **Meşru değil:**

| olay | zaman |
|---|---|
| M2-4 bitti | 2026-08-20 **01:25** |
| commit `92ef7a9` — `LA_AG_KAPI` true→false, `BATTLE_MENZILE_GIR` false→true | **08:02** |
| T1 başladı | **09:17** |

İki kapı **farklı tabanda** koştu. `tools/m2-kuyruk.sh` bu kuralı zaten yazıyor:
*"havuz ancak AYNI koşullarda meşrudur"*. Farklı tabandaki iki ölçümü havuzlamak,
ölçülen etkiyi değil taban farkını da içine katar.

### Sıradaki adım

Aynı soruyu **güncel tabanda** ve **ayrık tohumda** bir kez daha ölç (makine 2, havuz
228000-228127). O sonuç T1 ile havuzlanabilir → n=256. Beklenen taban ~230-280; iki
ölçüm de +300 civarındaysa geçer.

⚠ **U400b koşarken `BATTLE_TOPCU_DURAGAN` varsayılanı DEĞİŞTİRİLMEYECEK.** Kapı her parça
için taze node süreci açıyor ve dosyaları yeniden okuyor; ortada bayrak çevirmek kapının
ilk ve son parçalarını farklı kodla koşturur. Sevk kararı kuyruk boşalınca uygulanır.


---

## ⭐ PRO-DELTA DENETİMİ (2026-08-20) — "yazılmış ama ÖNGÖRÜ'de ölü" listesi

Bugün üç kez aynı desene rastladım, sonra sistematik baktım: **26 pro-delta** var,
hepsi `battleProDelta()` kapısının arkasında, ve **ÖNGÖRÜ pro DEĞİL** — yani hiçbiri
ÖNGÖRÜ kademesinde koşmuyor. Kodun kendi yorumu bunu yazıyor:
*"yalnız `pro` beyninde koşuyor (ÖNGÖRÜ pro DEĞİL → hiç çalışmıyor)"*.

⚠ **Bu bedava kazanç listesi DEĞİL.** Pro katmanı bütün olarak **net zararlı** ölçüldü
(2026-08-09: 18/48 → 6 delta kapalı 27/48) ve 9 deltanın hiçbiri tek başına anlamlı
çıkmadı. Bu yüzden kural: **her delta kendi mekanizma triyajından geçer, sonra kendi
maç kapısına girer.** Toptan açma yok.

### Yöntem: önce ucuz mekanizma triyajı, sonra pahalı maç kapısı

Maç kapısı ~6 saat. Mekanizma triyajı ~15 dakika ve şu soruyu sorar: *kural kendi
hedeflediği metriği kımıldatıyor mu?* Kımıldatmıyorsa maç kapısına hiç girmez.

### Bugün triyajdan geçenler

| delta | kapsam bayrağı | triyaj sonucu | durum |
|---|---|---|---|
| `supplyEscort` | `BATTLE_IKMAL_REFAKAT_INTEL4` | cephanesiz örnek 311→2 · ikmal ölen maç 3/6→**2/6** | **M2-10** kuyrukta |
| `indirectMassing`+`counterBattery` | `BATTLE_TOPCU_KUTLE_INTEL4` | kütle +0,75 (t 2,92) · cbPay %0→**%27** (t 3,56) | **M2-11** kuyrukta |

`supplyEscort` triyajı ayrıca **kendi yazdığım `BATTLE_IKMAL_TAKIP`'i eledi** — mevcut
kural her eksende yendi (tehdit kapısı sayesinde ikmal aracı tabandan bile az ölüyor).
Kendi bayrağımı sildim.

### Kayda değer taban bulgusu

`counterBattery` triyajında taban kolunda **cbPay 6 tohumun 6'sında da %0** çıktı:
ÖNGÖRÜ'nün topçusu düşmanın topçusunu **hiç** hedeflemiyor. Kod bunu açıkça yazıyor —
dolaylı ateş için varsayılan puan `sc = -d`, yani sadece en yakın.

### Sıradaki triyaj adayları (ölçülmüş teşhis taşıyanlar)

`ammoDiscipline` · `indirectCreep` · `killFocus` · `antiMatch` · `armorFace` ·
`localRatio` · `adUmbrella` · `jammerPost` · `heloMass` · `engineerForward`

Her biri için önce "kendi metriğini kımıldatıyor mu" ölçülecek.


### Triyaj sonuçları (2026-08-20, sürüyor)

| delta | kapsam bayrağı | triyaj | hüküm |
|---|---|---|---|
| `supplyEscort` | `BATTLE_IKMAL_REFAKAT_INTEL4` | cephanesiz 311→**2** · ikmal ölen maç 3/6→**2/6** | **M2-10 kuyrukta** |
| `indirectMassing`+`counterBattery` | `BATTLE_TOPCU_KUTLE_INTEL4` | kütle +0,75 (t 2,92) · cbPay %0→**%27** (t 3,56) | **M2-11 kuyrukta** |
| `indirectCreep` | `BATTLE_DOLAYLI_YAKLAS_INTEL4` | boşta %54,6→%35,4 ve cephanesiz 311→0 **ama 6/6 tohumda sağ topçu SIFIR** | **ELENDİ** (15. tuzak) |
| `armorFace` | `BATTLE_ZIRH_YONU_INTEL4` | zayıfPay −1,2 puan (t −0,17) · alınan hasar +213 | **ölçülemedi**, kuyruğa alınmadı |

**`armorFace` notu:** hüküm "etkisiz" değil **ölçülemedi** — std 17,3 / n=6 ile ancak
≥20 puanlık etki görülebilirdi. Ama tavan da düşük görünüyor: bu kurulumda taban
zayıf-taraf payı **%16,8**, kuralın belgelediği **%37**'nin yarısı. Belgelenen teşhis
`seed2024` izole kurulumundan; benimki 6 tohum + saldıran tarifi. Daha fazla tohum
harcamadan önce daha büyük kusurlara bakmak daha verimli.

| `antiMatch` | `BATTLE_ANTI_ESLESME_INTEL4` | fren **2068 kez bağladı** (kapalı kolda 0) ama sağkalım **−3,33 birim**, marj −1367 | **kuyruğa alınmadı** |

**`antiMatch` notu:** bağlanma sorunu yok — kural gerçekten çalışıyor. Sorun sonuçta:
sağ kalan kırmızı birim 6 tohumun 4'ünde düşüyor (11→3, 10→2, 10→4). t −1,81 ile
anlamlılık eşiğinin altında, ama **sağkalımı düşüren bir "fren"** güçlü kanıt olmadan
kuyruğa girmez. Muhtemel mekanizma (ölçülmedi): yanlış aleti geride tutmak kütleyi
böler ve birlikler tek tek yeniliyor.

**Triyaj ekonomisi:** beş aday ~2 saatte elendi. İkisi kuyruğa girdi, üçü elendi/askıya
alındı. Hepsi maç kapısına gitseydi **30 saat** harcanacaktı.

### Triyajın üç sorusu (bu turda oturdu)

1. **Bağlanıyor mu?** (`BATTLE_BALANCE` sayaçları — 10 dk). Bağlamıyorsa iş biter.
2. **Kendi metriğini kımıldatıyor mu?** Kımıldatmıyorsa maç kapısına girmez.
3. **Hayatta kalma ne oldu?** (15. tuzak). Metrik iyileşip birim ölüyorsa iyileşme sahte.


### Toplu triyaj — 11 delta tarandı (2026-08-20)

`tools/delta-triyaj.js` + `BATTLE_PRO_DELTA_TRIYAJ` kancası ile her delta tek başına
açılıp üç soru soruldu: **bağlıyor mu · hayatta kalma · sonuç**.

| delta | bağlanma | Δsağ (n=10) | Δmarj | hüküm |
|---|---|---|---|---|
| `supplyEscort` | ✔ | — | — | **M2-10 kuyrukta** (kendi metriği: cephanesiz 311→2) |
| `indirectMassing`+`counterBattery` | ✔ | — | — | **M2-11 kuyrukta** (cbPay %0→%27) |
| `ammoDiscipline` | (sayaç yok) | +1,20 (t 1,14) | +651 | aday, ölçülemedi |
| `localRatio` | 399 | +1,20 (t 0,98) | +727 | aday, ölçülemedi |
| `killFocus` | (sayaç yok) | **+0,00** (t 0,00) | +155 | **n=4'te yanılttı** |
| `commandCenter` | (sayaç yok) | 0,00 · marj **+0** | +0 | **NO-OP, elendi** |
| `adUmbrella` | 4355 | −0,25 | −1147 | negatif |
| `massMatch` | (sayaç yok) | −1,75 | −1875 | negatif |
| `indirectCreep` | ✔ | — | — | **elendi** (6/6 tohumda topçu ölüyor) |
| `armorFace` | ✔ | — | — | ölçülemedi, taban kusur küçük |
| `antiMatch` | 2068 | −3,33 (t −1,81) | −1367 | alınmadı |

### ⚠ `killFocus` — küçük-n'in canlı gösterisi

| n | Δsağ | Δmarj |
|---|---|---|
| 4 | **+2,50** | **+1160** |
| 10 | **+0,00** | +155 |

n=4'te listenin en iyisiydi ve tek başına maç kapısına gönderilecek gibi duruyordu.
n=10'da tamamen düzleşti. Bu deponun "3-6 tohumluk A/B'ler şüphelidir" kuralının
maliyetsiz bir doğrulaması — triyaj bile küçük n ile sıralama yapmamalı, yalnız
**eleme** yapmalı.

### Bugünün triyaj bilançosu

11 delta tarandı · **2'si kuyruğa girdi** · 4'ü elendi (no-op / zararlı / birim
öldürüyor) · 5'i "ölçülemedi" damgasıyla listede kaldı. Hepsi maç kapısına gitseydi
**~66 saat** harcanacaktı.


### `ammoDiscipline` — kendi metriğiyle ölçüldü, `supplyEscort` ile örtüşüyor

| metrik | taban | `ammoDiscipline` | `supplyEscort` |
|---|---|---|---|
| topçu boşta oranı | %54,6 | %26,7 | %32,9 |
| **Cephanesiz örnek** | 311 | **41** | **2** |
| sağ topçu (6 tohum toplam) | 9 | **6** | — |
| sıfır topçuyla biten maç | 2/6 | **4/6** | — |

Mühimmat tasarrufu gerçek (311→41) ama **topçu sağkalımı düşüyor**. Ve `supplyEscort`
aynı sorunu daha iyi çözüyor (311→**2**) ve üstelik ikmal aracının ölümünü de azaltıyor
(3/6→2/6). İkisi aynı boşluğu doldurduğu için `ammoDiscipline` şimdilik gereksiz.

**Karar:** `supplyEscort` maç kapısını (M2-10) geçerse `ammoDiscipline` tekrar
bakılmaz. Geçmezse sıradaki aday olur.
