# Savunan kendi bölgesini tutuyor mu? — `holdZone` teşhisi ve ölçümü

Tarih: 2026-08-04 · Dal: `savas-ai-mikrofix-konsantrasyon` · Kapı: `--zonedrift`

## 0. Kullanıcının iddiası

> "Saldıran veya savunma rolü, her iki rolde de AI benim hattıma yaklaşıyor. Aslında savunma
> rolünde kendi bölgesinde konuşlanıp beni zamana tüketerek kazanabilir, ki bu olması gereken."

**İddia doğrulandı.** Ölçüm aşağıda.

## 1. Ölçüm birimi

**DERİNLİK**: 0 = kendi arka kenarı, **1 = orta hat**, >1 = düşman yarısı. Taraflar Y'de ayrık
(kırmızı üstte, mavi altta), yarı-harita = 1725px. Konuşlanma derinliği ~0.24. Ağırlık ₺ ile alınır.

## 2. TABAN: savunan 6/6 tohumda ileri gidiyor

| tohum | t0 | zirve | orta hattı geçti | düşman yarısındaki max ₺ |
|---|---|---|---|---|
| 2024 | 0.24 | **1.25** | EVET t=300sn | 3570 |
| 777 | 0.24 | 0.80 | hayır | 1820 |
| 909 | 0.25 | 0.77 | hayır | 1410 |
| 3141 | 0.24 | 0.81 | hayır | 1140 |
| 2718 | 0.24 | **1.14** | EVET t=160sn | 3350 |
| 5150 | 0.24 | **1.42** | EVET t=140sn | **5450** |

Geçmediği tohumlarda bile orta hatta %77-81 yaklaşıyor. İlk 20 saniyede, daha temas yokken
0.24 → 0.38-0.46: **açılış hamlesi ileri gitmek.**

## 3. KÖK NEDEN (kod)

`js/BattlePlanning.js` — savunanın "savunma hattı":
```
homeY = side ? WORLD_H*0.30 : WORLD_H*0.70      // homeY'nin KENDİSİ derinlik 0.60
ay    = objective.y*0.4 + homeY*0.6              // objektif düşman tarafında → ay ≈ derinlik 1.04
```
Yani savunanın **emredilen** hattı zaten orta hattın ötesindeydi. Savunan 0.24'te konuşlanıp
emirle düşman yarısına yürüyordu.

## 4. `holdZone` deltası — mekanik ÇALIŞIYOR

`PRO_HOLD_LINE_DEPTH=0.70` (ana direniş hattı), `PRO_HOLD_DEEP_DEPTH=0.40` (ateş-desteği/lojistik),
`PRO_HOLD_MAX_DEPTH=0.88` sert tavan, `PRO_HOLD_STRIKE_DEPTH=1.00` (karşı-taarruz orta hatta durur).
Keşif muaf.

Sonuç: **orta hat geçişi 3/6 → 0/6**, zirve derinlik 1.42 → 0.81, düşman yarısındaki ₺ 5450 → 1350.

## 5. AMA: yer tutmak KAYBETTİRİYOR (6/6 → 4/6)

Süre-sonu kuralı "savunan otomatik kazanır" değil — **kim daha güçlü bitirdiyse**
(`BattleRules.js`, `effectiveValue = ₺ × hpOranı × (0.65 + 0.35×mühimmatOranı)`).

Kaybedilen maçların mekanizması (seed3141): savunan mühimmatı **0.24**'e inerken saldıranınki
**1.00**'de kaldı — savunan geride durup mühimmat yakıyor, saldıran harcamıyor, hazır-olma
çarpanı saldırana geçiyor.

### Neden yer tutmak karşılık vermiyor
Yer tutmanın motordaki tek karşılığı **siperlenme** (`dig_in`/`garrison`, 8sn hareketsiz → tam
siper → gelen hasara −%35). Ölçüldü:

| tohum | savunanın siperlenebilen ₺-payı | ulaşılan ort. siper | fiili hasar azalması |
|---|---|---|---|
| 2024 | 0.212 | 0.168 | ~%5.9 |
| 3141 (kayıp) | **0.000** | 0.00 | %0 |
| 5150 | 0.300 | 0.08-0.19 | ~%3-7 |

Yani yer tutmak inisiyatifi verip karşılığında **~%6** kazandırıyor.

## 6. "Hazırlanmış mevzi" denemeleri — İKİSİ DE ZARARLI (kod duruyor, varsayılan kapalı)

Motorda hazırlanmış-mevzi ödülü VAR ve herkese işler: **orman** +3 zırh / 0.40 örtü, **siper**
+6 zırh / 0.30 örtü (r=105). Sorun: savunma doktrini bunları kullanmıyordu.

| deneme | sonuç | neden |
|---|---|---|
| Örtü-çıpası (hattı 420px'teki ormana oturt) | 4/6 → **1/6** | grupları orman kümelerine topluyor, cepheyi boşaltıyor, orman hızı ×0.7 |
| İstihkâm siper-zinciri (hat üstünde) | 4/6 → **2/6**, 6 tohumda 2 siper | siper ANA HATTA diktiriliyordu; oradaki `closeThreat` koruması inşayı iptal ediyor, tek istihkâm temas hattında ölüyor |
| İstihkâm siper-zinciri (hattın gerisi 0.58) | **3/6**, 0 siper | istihkâm SUPPORT grubunda; grup emri (0.40) ile inşa hedefi (0.58) çekişiyor, `dist≤10` hiç sağlanmıyor |
| Grup derinliği = siper derinliği (0.60) | **4/6**, tohum başına en çok **1** siper | çekişme çözüldü ama tek siper (r=105) hiçbir şey kapsamıyor; zincir uzamıyor |

**KULLANICI DÜZELTMESİ (kabul edildi):** "ikmal aracımız var, bir de istihkâm; ikisinin de
özellikleri var." Doğru — ikmal aracının KENDİ `resupply` aurası var (r=4→300px, 1.0 mühimmat/sn,
`UnitData.js`), siperden bağımsız. Yani "istihkâmı hatta yollayınca ikmal çöküyor" ilk çıkarımım
YANLIŞTI; istihkâm siper dikmekte serbest. Gerçek engel yerleşim ve **sayı**.

## 7. SONUÇ: doktrin doğru, ORDU yanlış

`--armydump` seed2024, MAVİ = SAVUNAN, 23 birim / 6450₺:
- **1 İstihkâm** (200₺) — tek istihkâm 3sn/siper ile savunma hattı kuramaz
- Siperlenebilen piyade: 1 Piyade + 1 Tanksavar + 1 Komando + 1 MANPADS + 4 Havan → ₺'nin ~%20'si
- Buna karşılık: 1 Taarruz Helikopteri (800₺), ÇNRA (650₺), Topçu (450₺), 4 Havan (720₺) → **%30+ dolaylı/taarruzi**

Savunan, saldıranla neredeyse aynı **taarruzi** orduyu alıyor. Bu orduyla yer tutulamaz:
tutmaya zorlandığında inisiyatifi bırakıp karşılığında hiçbir mevzi avantajı almıyor.

**Sıradaki adım (kullanıcı kararı bekliyor):** savunan-rolüne özgü **savunma kompozisyonu** —
siperlenebilen piyade payını yükselt, istihkâm sayısını artır (siper zinciri + mayın), taarruzi
kalemleri (helo/ÇNRA fazlası) kıs. `holdZone` bundan sonra açılmalı; şu hâliyle varsayılan KAPALI.

## 8. Varsayılanlar (bu commit)

`holdZone: false` · `PRO_HOLD_COVER_R = 0` · `PRO_HOLD_ENGINEER_LINE = false` — hepsi ölçümle
kapatıldı, kod ve kapılar duruyor. Kapılar: `--forktest` ✓ `--liverepro` ✓ `--defertest` ✓ (201/201).

## 9. Araç

`--zonedrift [--seeds a,b] [--pro <delta>] [--hold hat,derin,tavan,ihtiyatDerin,örtüR,aralık,siperDerinlik]`
→ derinlik seyri, orta-hat geçişi, düşman yarısındaki ₺, siperlenme, örtü payı, kurulu siper,
effectiveValue ve mühimmat seyri.
