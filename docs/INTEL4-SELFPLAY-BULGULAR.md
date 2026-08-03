# intel4 Ayna Self-Play — Bulgular ve Geliştirme Planı

**Tezgâh:** `--intel4selfplay` · **32 maç** (16 tohum × 2 rol) · intel4 vs intel4 · 6500₺ · 360sn
**Beyin:** GERÇEK OYUN konfigürasyonu (varsayılan deltalar + `defense` + `range` + `drone`) — `--vsrec`'in "tüm deltalar" kurulumu değil.
**Tarih:** 2026-08-03 · commit `2f309b4`

> Ayna maçında galibiyet farkı **beyin farkı değil**, rol/harita yanlılığıdır. Asıl ürün toplam telemetridir.

---

## ÖLÇÜLEN (32 maç)

| Metrik | Ölçüm | Hedef | Durum |
|---|---|---|---|
| Saldıran galibiyeti | **13/32 = %41** | ~%50 (ayna) | ⚠️ savunma lehine yapısal eğim |
| Sonuç sebebi | attacker_eliminated **12**, defender_eliminated 8, attacker_dominant 5, time_expired 7 | — | saldıran daha sık siliniyor |
| Kayıp ₺/maç (saldıran) | **4997₺** | ~820₺ (oyuncu imzası) | ❌ **6× fazla** |
| Kayıp ₺/maç (savunan) | **3840₺** | ~820₺ | ❌ 4.7× fazla |
| Yerel yoğunluk (600px), medyan-tepe | **16 birim** | **L ≤ 8** (FAZ 3) | ❌ 64 taraf-maçın **62**'sinde ≥12 |
| Yerel yoğunluk, en büyük tepe | **24 birim** | — | ❌ tek aoe600 hasadı |
| Dağılım endeksi | **0.09–0.24** (düşük = blob) | — | ❌ blob doğrulanıyor |
| Kamikaze verimi | **204₺/birim** imha | ≥150₺ | ✅ **GEÇTİ** |
| Mürettebat terk | maç başı **2–7**, oran %14–35 | — | ✅ çalışıyor (ele geçirme de) |

**Birim ekonomisi (32 maç, hasar/maliyet):**
- **En verimli:** loitering_munition 3.36 · tank_destroyer 2.26 · at_team 1.49 · mortar_team 1.43 · artillery 1.26
- **En verimsiz (muharip):** armed_uav **0.127** (550₺, %100 kayıp, 4 kez kırmızı-bayrak) · scout_vehicle 0.099 · engineer 0.086
- **Sıfır hasarlı utility** (beklenen, hasarla ölçülmez): counter_battery_radar, recon_uav, medic, ew_vehicle
- **Ölçüm artefaktı:** `drone_operator` 0 görünüyor — sardığı dronun hasarı `loitering_munition`'a yazılıyor. Operatör+dron **birlikte** değerlendirilmeli.

---

## ÇIKARIM: kök-neden zinciri

```
BLOB (L medyan-tepe 16, hedef 8)
   └─> tek aoe600 salvosu 16 birimi birden buluyor
         └─> KAYIP HACMİ 4997₺/maç (oyuncu 820₺)
               └─> saldıran daha sık siliniyor (attacker_eliminated 12)
                     └─> saldıran galibiyeti %41
```
Kayıp hacmi ve rol dengesizliği **bağımsız kusurlar değil**, blob'un türevleri. `defense`-delta (XWIDE garnizon) yazılmış ve açık olmasına rağmen **yerel yoğunluğu düşürmemiş** — FAZ 3 kabulü (L≤8) ölçülmüş ve **düşmüş**.

---

## GELİŞTİRME PLANI (ölçüme dayalı, öncelik sırası)

### P1 — Blob'u kır: yerel yoğunluk tavanı (FAZ 3'ün gerçek kalanı)
`defense`-delta cepheyi genişletiyor ama **birim-yoğunluğunu sınırlamıyor**. Gereken: her birimin 600px komşuluğundaki dost sayısı L>eşik ise dağılma vektörü (mevcut `deblob` mekaniğinin savunmaya + garnizona da uygulanması).
- **Kabul:** medyan-tepe L ≤ 10 (ara hedef), sonra ≤8. `--intel4selfplay` ile ölç.
- **Beklenen türev:** kayıp ₺ düşer, saldıran/savunan dengesi %50'ye yaklaşır.
- Bayraklı (`BATTLE_INTEL4_DELTAS`), det-korumalı, `--vstournament` ile regresyon kontrolü.

### P2 — Kayıp hacmi bandı (FAZ 2(d) kabul metriği)
4997₺ → hedef bandı belirsiz; oyuncunun 820₺'si 5000₺ bütçeyle alınmıştı, burada 6500₺ var. **Önce hedefi bütçeye göre normalize et** (%16 → 6500₺'de ~1040₺), sonra P1 sonrası yeniden ölç. P1'den bağımsız iş yapmadan önce türev etkisini gör.

### P3 — `armed_uav` (SİHA) ekonomisi
550₺, hasar/maliyet 0.127, %100 kayıp oranı, 32 maçta 4 kez kırmızı-bayrak. Ya kullanım doktrini yanlış (menzil dışından vurmalı, dalmamalı) ya fiyat/istatistik dengesiz. **Not:** yalnız 5 konuşlanma → küçük örneklem, önce konuşlanma sayısını artıran bir tohum taraması gerekir.

### P4 — Rol dengesi (%41)
P1 sonrası yeniden ölç. Hâlâ ≤%45 ise saldıran doktrinine (yumuşatma penceresi / ana-çaba yoğunluğu) bak. **P1'den önce dokunma** — türev olabilir.

### P5 — Erken-STRIKE latch'i (FAZ 0 kalanı)
`--intel4exam`'daki tek kaybın imzası (t=17'de kısa ömürlü gerekçe → maçın %95'i STRIKE kilidi). Ayna taramasında duruş dağılımı toplanıyor; **birden fazla maçta doğrulanırsa** ele al. Tek tohum anekdotuyla dokunma.

---

## METODOLOJİ NOTU (bu taramadan öğrenilen)
İlk sürümde harness `battleBalanceReport`'tan **yanlış alan adlarını** okudu (`dispersal`/`abandoned` yerine `dispersalIndex`/`grayVehicle.abandoned`) → sessizce `null`/`0` döndü ve *"mürettebat terk mekaniği ölü"* gibi sahte bir bulgu üretti. Düzeltilince mekanik sağlam çıktı.
**Kural:** bir metrik "0" veya "null" geliyorsa, önce ölçüm kodunu doğrula, sonra bulgu ilan et.

İlgili: [[pixel-rts-intel4-pro-taban]] · `docs/INTEL4-PRO-SON-KOZ-PLAN.md`
