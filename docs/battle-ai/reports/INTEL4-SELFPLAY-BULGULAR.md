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

## ⛔ ÇÜRÜTÜLEN ÇIKARIM (önce ben iddia ettim, sonra ölçüp yanlışladım)

İlk yazdığım zincir şuydu: *blob → aoe600 hasadı → kayıp hacmi → saldıranın silinmesi → %41*.
**Veri bunu DESTEKLEMİYOR.** 64 taraf-maç üzerinde korelasyonlar:

| İlişki | r | Yorum |
|---|---|---|
| tepe-yoğunluk ↔ kayıp ₺ | **−0.02** | ilişki YOK |
| tepe-yoğunluk ↔ galibiyet | **+0.05** | ilişki YOK |
| merkez-payı ↔ galibiyet | **−0.01** | ilişki YOK (kazanan da kaybeden de %82 merkez) |
| ort-yoğunluk ↔ galibiyet | +0.42 | **ters yönde** — yoğun olan KAZANIYOR |
| dağılım endeksi ↔ galibiyet | +0.46 | yayılan kazanıyor |
| kayıp ₺ ↔ galibiyet | −0.90 | totolojik (az kaybeden kazanır) |

Tepe-yoğunluğu ≤12 olan taraflar **daha ÇOK** kaybetti (5094₺), ≥18 olanlar daha az (4464₺).
Son iki satırdaki pozitif korelasyonlar büyük olasılıkla **sağkalım yanlılığı**: kazanan tarafın birimleri hayatta kaldığı için hem ortalama yoğunluğu hem yayılımı yüksek kalıyor. Yani bu metrikler nedeni değil **sonucu** ölçüyor.

**Sonuç: bu tarama nedensel bir kaldıraç BULAMADI.** Blob gerçekten var (L medyan-tepe 16) ama kazanmayla/kaybetmeyle ölçülebilir bir ilişkisi yok.

### Ayrıca: FAZ 3 kabulünü aslında ÖLÇMEDİM
Plan "**t=20'de** yerel-tepe L≤8" diyor; ben **maç-boyu tepe**yi ölçtüm. İkisi aynı şey değil — erken yığılma ile maç ortası temas yığılması farklı olgular. FAZ 3 kabulü hâlâ **ölçülmemiş** sayılmalı.

### Erken-STRIKE (P5) bu konfigürasyonda YOK
32 maçın **hiçbirinde** saldıranın ilk STRIKE'ı t<30s değil (hepsi ≥t30). `--intel4exam`'da görülen t=17.1s anomalisi **o tezgâhın "tüm deltalar açık" kurulumuna özgü** görünüyor (backbone/profile dahil). Gerçek-oyun beyninde üremiyor.

---

## GELİŞTİRME PLANI (düzeltilmiş — kaldıraç bulunamadığı için önce ÖLÇÜM)

Kaldıraç bulunamadı; körlemesine "blob'u kır" yapmak veriye dayanmayan iş olur. Sıra bu yüzden **doğru metriği ölçmekle** başlıyor.

### P0 — Sağkalım-yanlılığı olmayan metrikler (ÖNCE BU)
Mevcut metriklerin çoğu maç-sonu durumunu ölçüyor → kazanan iyi görünüyor çünkü kazanmış. Gereken:
- **Erken pencere** ölçümü: t=20s / t=60s'de yerel-tepe L, sektör dağılımı, cephe genişliği (FAZ 3'ün kabulü zaten t=20 diyor).
- **Birim-başına normalize** kayıp (canlı birim sayısına bölünmüş), ham ₺ değil.
- **Maç kararının verildiği tik**e kadar ölçüm (şu an tüm maçlar 7300 tik tavanına koşuyor; karar sonrası öğütme sayıları şişiriyor).
- **Kabul:** en az bir metrik galibiyetle |r| ≥ 0.4 ilişki göstermeli. Göstermezse doğru şeyi ölçmüyoruz demektir.

### P1 — Rol dengesizliği (%41) — tek sağlam bulgu
Aynada saldıran 13/32 kazanıyor. Bu **ölçülmüş ve gerçek**; ama sürücüsü bilinmiyor (yoğunluk/merkez-payı ile ilişkisiz çıktı). P0'ın erken-pencere metrikleriyle sürücüyü ara; bulunmadan doktrin değiştirme.

### P2 — `armed_uav` (SİHA) ekonomisi
550₺, hasar/maliyet 0.127, %100 kayıp, 4× kırmızı-bayrak. **Ama 32 maçta yalnız 5 konuşlanma** → örneklem çok küçük, tek başına karar verdirmez. Önce SİHA'yı zorunlu konuşlandıran bir tohum taraması.

### P3 — FAZ 3 kabulünü gerçekten ölç (t=20, L≤8)
Ölçüldüğünde düşerse `defense`-delta'nın yoğunluk tavanı eksikliği gerçek bir iş olur. **Şu an ölçülmemiş durumda.**

### ~~P5 — Erken-STRIKE latch'i~~ — DÜŞTÜ
Gerçek-oyun beyninde 32 maçta üremiyor (hepsinde ilk STRIKE ≥t30s). `--intel4exam`'ın tüm-deltalar kurulumuna özgü.

---

## METODOLOJİ NOTU (bu taramadan öğrenilen)
İlk sürümde harness `battleBalanceReport`'tan **yanlış alan adlarını** okudu (`dispersal`/`abandoned` yerine `dispersalIndex`/`grayVehicle.abandoned`) → sessizce `null`/`0` döndü ve *"mürettebat terk mekaniği ölü"* gibi sahte bir bulgu üretti. Düzeltilince mekanik sağlam çıktı.
**Kural:** bir metrik "0" veya "null" geliyorsa, önce ölçüm kodunu doğrula, sonra bulgu ilan et.

İlgili: [[pixel-rts-intel4-pro-taban]] · `battle-ai/plans/INTEL4-PRO-SON-KOZ-PLAN.md`
