# 25 BİRİM SAĞLIK RAPORU — hangileri bakılmamış, sorunları ne

**Tarih:** 2026-08-06 · **Araç:** `tools/birim-sagligi.js` · **Ölçüm:** 6 tohum, gerçekçi ordular,
`intel4pro` gövde (aktif beceriler: `standoff`, `heloHunt`)

**GETİRİ** = imha ettiği düşman değeri ÷ kendi maliyeti (forensik `attackerId`+`lethal` ile atfedilir).
x1.0 = kendi parasını çıkarıyor. **boşta** = mühimmatı varken menzilinde hedef olmayan tik oranı.

> **Kurgu notu:** ilk sürümde 26 birimin hepsi aynı 6500₺'ye zorlanmıştı → "her tipten bir tane"
> gibi anlamsız bir ordu çıkıyor ve MBT bile x0 görünüyordu. Düzeltildi: ordular NORMAL kurulur,
> nadir birimler normal ordunun içine 1-2 adet sokulur.

## Silahlı birimler (getiriye göre — kötüden iyiye)

| birim | ₺ | ATIŞ | hedefli | boşta | ömür | **GETİRİ** | tam-yükle öldü | bakıldı mı |
|---|---|---|---|---|---|---|---|---|
| **ballistic_missile** | 1050 | 1 | %100 | %0 | 365sn | **x0** | %0 | ✔ |
| **scout_vehicle** | 180 | 3.8 | %2 | %98 | 200sn | **x0** | %45 | ✗ |
| **engineer** | 200 | 0 | %2 | %98 | 177sn | **x0** | — | ✗ |
| **sam_battery** | 700 | 0.7 | %5 | %95 | 117sn | **x0.04** | **%67** | ✗ |
| **ifv** | 320 | 2 | %7 | %93 | **57sn** | **x0.10** | **%70** | ✗ |
| **artillery** | 450 | 6.6 | %51 | %49 | 92sn | x0.11 | %33 | ✔ |
| **mlrs** | 650 | 2.8 | %58 | %42 | 321sn | x0.15 | %0 | kısmen |
| attack_helo | 800 | 5.5 | %79 | %21 | 82sn | x0.28 | %0 | ✔ |
| infantry | 100 | — | %9 | %91 | 109sn | x0.31 | — | ✗ |
| manpads_team | 190 | 1.3 | %6 | %94 | 140sn | x0.33 | %20 | ✗ |
| armed_uav | 550 | 2.7 | %55 | %45 | 143sn | x0.35 | %0 | kısmen |
| mortar_team | 180 | 13.7 | %24 | %76 | 179sn | x0.39 | %8 | ✔ |
| mbt | 500 | 5.1 | %14 | %86 | 131sn | x0.39 | %0 | ✔ |
| commando | 320 | — | %8 | %92 | 165sn | x0.60 | — | ✗ |
| **spaag** | 300 | 22.2 | %56 | %44 | 220sn | **x1.13** | %33 | ✗ |
| **tank_destroyer** | 420 | 5.8 | %28 | %72 | 185sn | **x1.45** | %0 | ✔ |
| **at_team** | 170 | 3 | %12 | %88 | 146sn | **x1.55** | %22 | ✗ |

*(infantry/commando "ATIŞ —": mühimmatları sınırsız, atış sayacı mühimmat düşüşünden okunuyor.)*

## Silahsız birimler (ömürle değerlendirilir)

| birim | ₺ | ömür | not | bakıldı mı |
|---|---|---|---|---|
| **transport_helo** | 400 | **111sn** | erken ölüyor; hiç taşıma yapıyor mu ölçülmedi | ✗ |
| **command_vehicle** | 600 | **123sn** | geri bölge birimi için kısa ömür | ✗ |
| medic | 160 | 203sn | — | ✗ |
| recon_uav | 150 | 174sn | — | kısmen |
| ew_vehicle | 480 | 229sn | jam mekaniği düzeltildi, konumlandırma elendi | ✔ |
| drone_operator | 240 | 228sn | — | kısmen |
| supply_truck | 250 | 238sn | refakat elendi (mühimmat bağlayıcı kısıt değil) | ✔ |
| counter_battery_radar | 350 | 365sn | hiç ölmüyor; işe yarıyor mu ölçülmedi | ✗ |

## Öncelik sırası — boşa giden para (maliyet × (1 − getiri))

| # | birim | boşa giden | asıl sorun |
|---|---|---|---|
| 1 | **ballistic_missile** | ~1050₺ | %100 hedefi var, 1 atış yapıyor, **hiçbir şey öldürmüyor** |
| 2 | **sam_battery** | ~670₺ | %95 boşta, 0.7 atış, **%67 tam yükle ölüyor** |
| 3 | **mlrs** | ~550₺ | %58 hedefi var ama 2.8 atış — 321sn yaşayıp az iş yapıyor |
| 4 | **attack_helo** | ~575₺ | %79 hedefi var, 5.5 atış, ama **82sn'de ölüyor** |
| 5 | **command_vehicle** | ~600₺ | 123sn'de ölüyor (geri bölge birimi) |
| 6 | **artillery** | ~400₺ | 92sn'de ölüyor |
| 7 | **transport_helo** | ~400₺ | 111sn'de ölüyor; taşıma yapıyor mu bilinmiyor |
| 8 | **ifv** | ~290₺ | **57sn — en kısa ömür**, %70 tam yükle ölüyor |
| 9 | **engineer / scout_vehicle** | ~380₺ | ikisi de x0; scout %45 tam yükle ölüyor |

## Çıkarımlar

**İyi çalışan üçlü:** `at_team` (x1.55), `tank_destroyer` (x1.45), `spaag` (x1.13) — üçü de
ucuz-orta maliyetli, uzun yaşayan, karşı-birim uzmanı. **Üçü de hiç incelenmemişti.**

**En pahalı üç birim en kötü getiriye sahip:** ballistic (1050₺ → x0), attack_helo (800₺ → x0.28),
sam_battery (700₺ → x0.04). Bütçenin büyük kalemleri para kaybettiriyor.

**"Tam yükle ölmek" yeni bir kırmızı bayrak:** sam_battery %67, ifv %70, scout_vehicle %45.
Bu birimler mühimmatlarını kullanmadan ölüyor — ya menzile giremiyorlar ya da yanlış yerdeler.

**`hedefli` sütunu iki ayrı hastalığı ayırıyor:**
- *Hedefi var ama iş çıkmıyor* (ballistic %100, mlrs %58, artillery %51) → atış/etki sorunu
- *Hedefi hiç yok* (sam %5, ifv %7, scout %2, engineer %2, mbt %14) → konum/menzil sorunu

---

# BİRİM #1 — BALİSTİK FÜZE (1050₺, getiri x0) · ELE ALINDI

## Teşhis: sorun mesafe değil GÖRÜŞ — ve önceki hükmüm yanlıştı

| ölçüm (6 tohum, normal ordu) | değer |
|---|---|
| hedef geometrik olarak menzilde | **%100** |
| hedef **görünür** | **%0-3** |
| hiç ateş etmeyen tohum | **4/6** |
| ateş edenlerde ilk atış | 156sn / 192sn |

**Dün "gözcü sorunu değil (%9.4)" demiştim — o ölçüm `KESIF-balistik-1` tarifiyle, yani
keşif-AĞIRLIKLI bir orduyla yapılmıştı.** Ölçüm kurgusu bulguyu tersine çevirmiş. Normal orduda
balistik hedefini göremiyor.

**Doğrudan kanıt** (orduya 2 keşif İHA + 2 keşif aracı zorunlu kılınca):

| | keşif YOK | keşif VAR |
|---|---|---|
| hiç ateş etmeyen | 4/6 | **1/6** |
| ilk atış | 156-192sn | **11-20sn** |

## Kural: `spotterRequirement` — "gözcüsüz keskin nişancı alınmaz"

`js/BattleDeployment.js` `battleGozcuKuraliUygula` — menzili kendi görüşünün `PRO_SPOTTER_KAT`(3)
katından fazla olan silahlı birim varsa, orduda en az `PRO_SPOTTER_MIN`(3) keşif bulunur; yoksa
**en ucuz** gözcü satın alınır (mızrak bütçesini az bozsun). Para yetmezse vazgeçilir.
**Her iki kurucu yola da uygulanır** — tarif modu sezgisel zinciri tamamen atlıyor (ilk sürümde
yalnız sezgisel yola koymuştum ve kural hiç bağlamadı).

## Sonuçlar

| | kural KAPALI | kural AÇIK |
|---|---|---|
| hiç ateş etmeyen | **4/6** | **0/6** |
| ilk atış | 156sn / 192sn | **10-13sn** |
| toplam atış (6 tohum) | 2 | **6** |
| **verdiği hasar** | 516 | **2243** |
| öldürdüğü birim | 2 | 0 |

**Hasar 4.3× arttı.** Öldürme sayısı gürültülü — 600 hasarlık patlama çok birime dağılıyor,
öldürücü darbe başkasına yazılıyor; bu yüzden ekonomik ölçü olarak HASAR alındı.

**Maç kapısı: FARK YOK** — ve sebebi öğretici. Test ettiğim gerçekçi kompozisyon (`ORN-244`)
zaten keşif içeriyor (İHA %3.5 + keşif aracı %5.1 → 3+ birim), yani kural bağlamıyor ve iki kol
birebir aynı çıkıyor.

**Dolayısıyla bu bir GÜVENLİK AĞI:** normal orduları değiştirmez, keşif-fakiri orduların 1050₺'lik
balistiği çöpe atmasını engeller. Turnuva keşifsiz kompozisyonları da denediği için orada değer
üretir. Varsayılan AÇIK; maliyeti bağlamadığında sıfır.

**Kapılar:** forktest `true` · liverepro `false`.
