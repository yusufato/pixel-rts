# PIXEL RTS — TAM BİRİM DENGE RAPORU (26 birim)

**Veri kaynağı:** `js/units-modern.json` (motor `js/UnitData.js` üzerinden çalıştırır — otomatik ayna, birebir aynı). Tüm sayılar **taban** değerlerdir (tech-bonusu, komuta-halesi, veteranlık, zırh-yüzeyi durumsal çarpanları HARİÇ). Menzil/görüş = **tile (kare)**, hız = kare/sn, hasar = tek isabet.

> **Nasıl okunmalı:** DPS = hasar × atış-hızı(rof). "Etkin DPS" = DPS × isabet-tabanı × hasar-matrisi çarpanı (hedefin zırh-tipine göre). Fiyat = kaynak (₺). Bir birimin "konumu" = rolü + güç/zayıflık + fiyat-etkinlik + karşıtları + meta-duruşu.

> ### ⚠️ SAHA-ÇAPRAZLAMA NOTU (v2 — 39-maç arşivi + kod-denetimi)
> Kağıt-rapor 39-maçlık saha-arşiviyle ve motor-koduyla çaprazlandı. **İki "kağıt-only" mekanik bulundu → İKİSİ DE ÇÖZÜLDÜ (kullanıcı-kararıyla uygulandı):**
> 1. **ÇNRA "interceptable" — eskiden sahada YOK'tu → ARTIK BAĞLI.** PD-eşiği (150) ÇNRA roketini (55) görmüyordu. **ÇÖZÜM: salvo-PD** — SAM artık ÇNRA-salvosundan **en çok 3 roket** önler (salvo-bütçesi → SAM-mühimmatı boşaltma-istismarı yok). Balistik (600) eski eşik-kapılı yolda. → ÇNRA'nın dizgini artık cephane-3 + cam + **kısmi-PD**.
> 2. **command_shock — eskiden UYGULANMAMIŞTI → ARTIK UYGULANDI.** Payoff-analizi: komuta-halesi (+%12 ordu-geneli DPS + rally) ₺600'e çok-güçlü, dezavantajsız undercosted'dı. **ÇÖZÜM:** HQ ölünce yarıçap-12'deki dostlara **12sn emir-felci** (koordinesiz-ateş ×0.72 + bastırma-şoku) + COMMAND_SHOCK telemetri. Force-multiplier artık yüksek-risk-yüksek-getiri.
>
> **Saha-doğrulanmış verdict-kaymaları:** Balistik (niş→gözcü-beslemeli alfa-kralı), Komando (⚠️→💪 saha-yıldızı), ZMA (dengeli→rol-oynanmıyor 0.54 hasar/₺), SPAAG (undercosted ama jammer-öncesi nerf-etme), AT (dizgin=fiyat-değil-bastırma). Detaylar birim-girdilerinde işaretli.
>
> **4 telemetri EKLENDİ** (analistin açık-sorularını ölçülebilir kılmak için, hepsi determinist ✓): `INTERCEPT.shooterType+salvo` (PD neyi önlüyor okunur — artık ÇNRA-salvo-intercept'leri de görünür), `AMMO_EMPTY` (AT-4-atış + ÇNRA-salvo ekonomisi), `DRONE_LOST` (kaç drone boş-patladı — drone↔jammer cevabı), `COMMAND_SHOCK` (HQ-ölümü kaç birimi felç etti). + `JAMMED` (mevcut).

---

## 0. TEMEL MEKANİKLER (denge-çekirdeği)

### Hasar-matrisi (hasar-tipi → zırh-tipi çarpanı)
| Hasar-tipi | infantry | light | heavy | structure | air |
|---|---|---|---|---|---|
| **small_arms** | 1.00 | 0.35 | 0.05 | 0.10 | 0.15 |
| **he** (yüksek patlayıcı) | 1.20 | 0.80 | 0.30 | 1.00 | 0.00 |
| **ap** (zırh-delici) | 0.40 | 1.10 | 1.00 | 0.60 | 0.00 |
| **shaped** (kümülatif) | 0.15 | 1.20 | **1.40** | 0.90 | 0.00 |
| **frag** (parça) | 0.90 | 0.50 | 0.10 | 0.20 | **1.30** |
| **sam** | 0.00 | 0.00 | 0.00 | 0.00 | **1.60** |

**Çıkarımlar:**
- **heavy zırh** (Tank, Tank Avcısı) yalnız **ap/shaped**'e ölür; small_arms ona ×0.05 (pratikte bağışık), he ×0.30 (zayıf).
- **shaped** en iyi anti-heavy (×1.40) — ATGM/kamikaze/helo/SİHA hep shaped. **heavy'nin doğal düşmanı.**
- **air** yalnız **sam (×1.6)** ve **frag (×1.3)**'e ölür — SAM/SPAAG/MANPADS. ap/shaped/he uçağa ×0.
- **structure** (üsler) he'ye tam-hasar, small_arms/frag'e bağışık.

### Zırh-yüzeyi çarpanları (yalnız heavy — üstten/arkadan vuruş çok daha ölümcül)
| Birim | ön | yan | arka | üst |
|---|---|---|---|---|
| Tank | 1.0 | 0.65 | 0.40 | **0.35** |
| Tank Avcısı | 1.0 | **0.50** | **0.30** | **0.25** |
| ZMA (light) | 1.0 | 0.75 | 0.55 | 0.45 |

→ **Kamikaze `strike_top_armor`** üst-yüzeyi (0.25-0.35) vurur → çarpan 1/top ≈ ×2.2'ye kadar. Tank Avcısı'nın yanı/arkası cam; flanklama kritik.

---

## 1. PİYADE SINIFI (5 birim)

### 🟩 Piyade (infantry) — T1
`₺100 · hp220 · zırh infantry · hız1.0 · görüş7`
- **Silah:** hafif silah 14×1.4rof = **19.6 DPS** (small_arms), menzil4, acc0.80
- **Etkin:** vs piyade 15.7 · vs light 5.5 · vs heavy **0.8** (bağışık)
- **Yetenek:** garrison, dig_in · roleTags: line_holder, cheap_mass, urban
- **KONUM:** ⚖️ En ucuz kütle/hat-tutucu. Zırha çaresiz ama sayı+siper+kentte değerli. Fiyat-etkin taban-birim. **Dengeli** — rolü net, ucuz olması amaçlanmış. Tek başına zayıf, kütlede ve mevzide güçlü.

### 🟥 Tanksavar Timi (at_team) — T1 ⭐
`₺170 · hp160 · zırh infantry · hız0.9 · gizlilik0.3`
- **Silah:** ATGM 300×0.25rof = **75 DPS** (shaped), menzil7, acc0.85, **cephane 4** (sınırlı!)
- **Etkin:** vs heavy **89** · vs light 76 · vs piyade 9.6
- **Yetenek:** garrison, ambush · roleTags: anti_armor, ambush
- **KONUM:** 🚩 **Meta-tanımlayıcı anti-armor.** ₺170'e heavy'ye 89 etkin-DPS = fiyatına göre EN yüksek anti-zırh çıktısı. Erime-analizinde saldıran-armor'u biçen #1-2 katilden biri (mızraksız-devirde tek başına armor-metasını öldürdü). **⚠️ SAHA-DÜZELTME:** cephane-4 dizgini sahada **görünmez** — RESUPPLY bolluğunda 4-atış sınırı hiç bağlamadı. Gerçek dengeleyici **fiyat değil BASTIRMA**: yumuşatma-doktrini gelince taarruzlar 6/6'ya döndü. **₺170 kalsın; izlenecek: "ikmal-başına-AT-atışı"** (yeni AMMO_EMPTY telemetrisi bunu görür). Zayıflığı: hp160 cam + hız0.9.

### 🟨 Havan Timi (mortar_team) — T1
`₺180 · hp150 · zırh infantry · hız0.7`
- **Silah:** havan 40×0.4rof = 16 DPS (he), menzil12 **dolaylı**, AoE2.0, ignoresCover0.8, cephane14
- **Etkin:** vs piyade 19 (AoE ile ×alan) · siper-kırıcı (ignoresCover)
- **KONUM:** ⚖️ Ucuz dolaylı-ateş + siper-kırıcı. Düşük tekil-DPS ama alan+menzil+siper-bypass değeri. Piyade-yığınına ve mevziye karşı iyi. **Dengeli niş** — hafif indirect, topçunun ucuz kardeşi.

### 🟦 MANPADS Timi (manpads_team) — T2
`₺190 · hp150 · gizlilik0.6 · tespit0.5`
- **Silah:** omuzdan-SAM 190×0.2rof = 38 DPS (sam, **yalnız hava**), menzil11, cephane3
- **Etkin:** vs air **45.6** · **kara-saldırısı YOK** (no_ground_attack)
- **Yetenek:** garrison, ambush, hold_fire · revealsOnFire
- **KONUM:** ⚠️ Ucuz gizli anti-hava/anti-drone pusu. Cephane3 + tek-rol (hava). Helo/İHA caydırıcı. **Niş ama gerekli** — ucuz hava-savunması. Ateş edince açığa çıkar (revealsOnFire) → tek-atış-kaç.

### 🟪 Komando (commando) — T3
`₺320 · hp260 · zırh infantry(+1) · hız1.3 · gizlilik0.85 · tespit0.4`
- **Silah:** otomatik 22×1.6 = **35 DPS** (small_arms, acc0.92, ignoresCover0.5) + yıkım-çarjı 260 (he, menzil1, situational)
- **Yetenek:** infiltrate, mark_target, sabotage · roleTags: raider, backline_hunter, stealth
- **KONUM:** 💪 **SAHA-YÜKSELTME (⚠️→💪):** Kağıtta "yanlış-kullanılırsa-israf niş" dedim; saha **son-dönemin yıldızı** — 6-öldürmelik sızma-destanı, iki tarafta da istikrarlı HVT-söküm. Gizlilik0.85+hız1.3 → arka-hat avcısı (topçu/radar/ikmal/komuta). **mark/sabotage daha BAĞLANMADAN bile** 💪 hak ediyor (yetenekler bağlanınca daha da güçlü). Zırha zayıf (small_arms) ama işi o değil.

---

## 2. ZIRHLI SINIF (3 birim)

### 🟫 Tank (mbt) — T2 ⭐
`₺500 · hp900 · zırh heavy(8) · hız1.6 · görüş8`
- **Silah:** ana-top 150×0.35 = **52.5 DPS** (ap, AoE0.8) + eşgüdümlü-MG 10×2.0=20 (small_arms) · cephane22
- **Etkin (top):** vs heavy 46 · vs light 51 · vs piyade 18.5 (+MG 15)
- **Zırh-yüzeyi:** ön1.0/yan0.65/arka0.40/üst0.35 · EHP vs small_arms devasa (×0.05)
- **KONUM:** 💪 **Cephe belkemiği/hat-yarıcı.** hp900+heavy = piyade ateşine bağışık, ap/shaped'e ölür. Çift-hedefli (top+MG). Fiyatına göre çok dayanıklı. Denge: pahalı (₺500/supply5) + AT-timi/kamikaze/helo'ya (shaped) zayıf + üstü/arkası ince. **Doğru dengeli ağır-birim** — karşıtları net (shaped-spam), tek başına ezici değil.

### 🟧 Mekanize Piyade / ZMA (ifv) — T1
`₺320 · hp480 · zırh light(4) · hız2.2 · taşıma4`
- **Silah:** otomatik-top 26×1.2 = **31 DPS** (ap, AoE0.3) · cephane40
- **Etkin:** vs light 27 · vs heavy 24 · vs piyade 9.7
- **Taşıma:** 4 slot (piyade) · roleTags: transport, screen, flanker
- **KONUM:** ⚠️ Kağıtta "dengeli işçi-birim"; **SAHA: 0.54 hasar/₺ = rosterin EN VERİMSİZ savaş-birimi.** Ama **stat-sorunu değil GÖREV-sorunu:** flanker/taşıyıcı rolü AI'da hiç oynanmadı, zırh-yüzeyi (yan/arka bonus) hiç kullanılmadı → düz cephe-döğüşünde light-gövdesi eriyor. Tasarım-niyeti sağlam (hızlı-ekran-taşıyıcı), saha-gerçeği zayıf. **Ayar-adayı DEĞİL, AI-kullanım-adayı** (flank/taşıma davranışı bağlanmalı).

### 🟥 Tank Avcısı (tank_destroyer) — T2 ⭐
`₺420 · hp520 · zırh heavy(6) · hız2.0 · görüş9 · gizlilik0.2`
- **Silah:** yüksek-hızlı-top 290×0.3 = **87 DPS** (ap), menzil**9** (uzun!), acc0.90, cephane16
- **Etkin:** vs heavy **78** · vs light 86 · vs piyade 31
- **Zırh-yüzeyi:** ön1.0/**yan0.50/arka0.30/üst0.25** (flankı cam!)
- **KONUM:** 🚩 **Erime-analizinin #1 katili.** ₺420'ye menzil9'dan 78-86 etkin-DPS + heavy-ön-zırh = anti-armor overwatch aslı. Saldıran-armor'u uzaktan söker. Denge-endişesi: uzun-menzil + yüksek-AP-DPS + sağlam-ön → çok yönlü tehdit. DENGELEYEN: yan/arka/üst çok ince (flanklama/kamikaze-üst-vuruş öldürür) + shaped'e (helo/drone) zayıf. **Kilit anti-armor; drone-doktrini özellikle bunu hedefliyor.**

---

## 3. DOLAYLI ATEŞ (3 birim)

### 🟨 Topçu (artillery) — T2
`₺450 · hp280 · zırh light(1) · hız1.1 · görüş6`
- **Silah:** obüs 95×0.18 = 17 DPS (he), menzil**20 dolaylı**, AoE**3.0**, ignoresCover0.9, cephane8 · **spotter gerekir**
- **KONUM:** ⚖️ Kuşatma/bastırma/alan-inkarı. Düşük tekil-DPS ama AoE3.0×menzil20 = kütle+mevzi ezer. Kırılgan (hp280 light, görüş6 → spotter'a bağımlı). **Dengeli kuşatma** — karşıtı: karşı-batarya-radarı (açığa çıkarır) + hızlı-flank (kırılgan). he → heavy'ye zayıf (×0.3), piyade/light'a güçlü.

### 🟧 ÇNRA / MLRS (mlrs) — T3
`₺650 · hp260 · zırh light(1) · hız1.4`
- **Silah:** roket-salvosu 55×**12 salvo** = 660 patlama/yaylım (he), menzil**26**, AoE2.5, rof0.05 (~20s'de bir yaylım), cephane3 · spotter gerekir
- **Yetenek:** shoot_and_scoot · roleTags: burst_damage, anti_mass
- **KONUM:** 💪 Patlama-hasarı kralı — tek yaylımda kütleyi siler. **✅ SAHA-DÜZELTME UYGULANDI:** eskiden "interceptable" flag'i vardı ama PD-eşiği (150>55) görmüyordu → 39 maçta hiç önlenmedi (en-istikrarlı katil, 4670 hasar/15 öldürme). **ARTIK salvo-PD BAĞLI:** SAM salvodan max-3 roket önler (bütçe → SAM-boşaltma-istismarı yok). Dizginler: ₺650 + cephane3 + hp260 cam + **kısmi-PD**. Hâlâ güçlü anti-kütle ama artık SAM'lı-rakibe karşı net-sayılır.

### ⬛ Balistik Füze Bataryası (ballistic_missile) — T4
`₺1050 · hp300 · zırh light(1) · hız0.9`
- **Silah:** taktik-füze 600 (he), menzil**40**, AoE**6.0**, rof0.015 (~66s), **cephane1**, interceptable
- **KONUM:** 💪 **SAHA-YÜKSELTME:** Kağıtta "uç-niş" dedim; saha **1.89 hasar/₺ = rosterin 2. verimi** (gözcü-beslemeli ellerde tek-atışta 7-10 öldürme). Devasa tek-vuruş+menzil. "Lüks" hükmü **yalnız yumak-dünyası bitince (L≤6 dağınık-dünya)** doğru — yumak-metasında **alfa-kralı**. Balistik GERÇEKTEN önlenir (600≥150 → SAM/PD işler, cephane-doyurma mümkün) — ÇNRA'dan farkı bu. Denge: fiyat + cephane1 + 66s + intercept sınırlıyor ama etkisi hafife alınmamalı.

---

## 4. KEŞİF / RADAR (1 + recon aşağıda)

### 🟦 Hava-Arama Radarı (counter_battery_radar) — T2
`₺350 · hp200 · zırh light · görüş**20** · tespit0.6 · airRadar`
- **Silahsız.** Aura: counter_battery (dolaylı-atıcıyı açığa çıkarır, yarıçap30, süre8)
- **KONUM:** ⚖️ İstihbarat çarpanı — topçu/ÇNRA'yı ifşa eder + hava-arama (SAM'a hedefleme). Görüş20 devasa. Kırılgan (hp200, silahsız, emissions0.9 → tespit edilir). **Enabler** — tek başına işe yaramaz, doğru orduda topçu-düellosu+hava-savunmasını çevirir. Karşıtı: komando/kamikaze (arka-hat avı).

---

## 5. HAVA SAVUNMA (2 birim)

### 🟩 SPAAG (spaag) — T2 ⭐
`₺300 · hp380 · zırh light(3) · hız1.8 · tespit0.5`
- **Silah:** namlulu-HS 34×2.5 = **85 DPS** (frag), menzil hava13/kara6.4, cephane60(bol), acc0.72
- **Etkin:** vs air **80** · vs piyade 55 · vs light 30.6 · vs heavy 3.4
- **KONUM:** 💪 **En iyi fiyat-etkin çift-rol.** ₺300'e hava13-menzilde 80 etkin + kara6.4-menzilde piyadeye 55. Bol cephane, hızlı. **SAHA-ONAY:** undercosted doğrulandı (drone-dalgası kırma 10-öldürme, göz-avı 5-6, kill/₺-zirvesi). **⚠️ NERF-ETME (analist-uyarı):** değerinin kaynağı **drone-metası** — jammer canlanmadan SPAAG'a dokunmak en-güçlü doktrini (drone) DOLAYLI büfler. **Jammer-sonrası yeniden-tart.** Denge: heavy'ye çaresiz (frag ×0.1), menzil-kısa.

### 🟦 SAM Bataryası (sam_battery) — T3
`₺700 · hp320 · zırh light(2) · pointDefense0.6`
- **Silah:** SAM 220×0.3 = 66 DPS (sam), menzil**22** (uzun), acc0.86, cephane8 · **canIntercept** · pointDefense %60
- **Etkin:** vs air **91** · **kendini savunamaz** (no_self_defense, kara-silahı yok)
- **KONUM:** ⚖️ Uzun-menzil alan-hava-inkarı + füze-önleme (ÇNRA/balistik önler). Menzil22 = geniş şemsiye. Ama ₺700 + hp320 + **kara-savunması sıfır** (eskort şart) + emissions1.0 (ifşa). **Dengeli anti-hava aslı** — pahalı, korunması gerek; komando/kamikaze/kara-baskını öldürür. SPAAG ile tamamlayıcı (SAM=uzun/pahalı, SPAAG=kısa/ucuz/kendini-savunur).

---

## 6. HAVA (2 birim)

### 🟥 Taarruz Helikopteri (attack_helo) — T3 ⭐
`₺800 · hp420 · zırh air(3) · hız**4.5** · görüş12 · yakıt90`
- **Silah:** ATGM-podu 200×0.5 = **100 DPS** (shaped), menzil12, acc0.84, cephane12
- **Etkin:** vs heavy **117** · vs light 100 · vs piyade 12.6
- **Yetenek:** nap_of_earth (AA-kaçış), return_to_base
- **KONUM:** 💪/🚩 **En yüksek anti-armor DPS.** hız4.5 + shaped100-DPS + menzil12 = hızlı-müdahale tank-avcısı; heavy'ye 117 etkin. Denge-endişesi: mobilite+DPS çok yüksek. DENGELEYEN: **hava** = SAM(91)/SPAAG(80)/MANPADS'e ölür + yakıt90 (üsse döner) + pahalı ₺800 + nap-of-earth mikro-gerektirir. **Hava-savunması olmayan rakibi ezer; SAM/SPAAG varsa risk.** Klasik taş-kağıt: helo→armor, AA→helo.

### 🟦 Nakliye Helikopteri (transport_helo) — T2
`₺400 · hp500 · zırh air(1) · hız4.0 · taşıma6 · yakıt120`
- **Silahsız.** fast_rope, load/unload · roleTags: mobility, insertion
- **KONUM:** ⚖️ Saf mobilite — 6 piyade hızlı-kuşat/kanat-indirme. **Enabler** (yalnız-taşıma; SUPPLY-truck kara/mühimmat, bu asker taşır — rol ayrımı net). Kırılgan hava (AA'ya ölür, silahsız). Denge: taktik-sürpriz aracı, doğrudan-güç değil.

---

## 7. İHA (3 birim)

### 🟦 Keşif İHA (recon_uav) — T1
`₺150 · hp90 · zırh air · hız3.0 · görüş16 · tespit0.7 · gizlilik0.4 · jammable0.9 · yakıt180`
- **Silahsız.** provides **spotter** (topçu/ÇNRA/balistik'i besler), loiter
- **KONUM:** ⚖️ Ucuz göz + spotter-enabler (dolaylı-ateşin gözü). Görüş16. Kırılgan (hp90) + **jammable0.9** (EH-aracı devre-dışı bırakır). **Enabler** — topçu-ordusunun beyni; jammer/AA ile sayılır. Fiyat-etkin istihbarat.

### 🟥 SİHA (armed_uav) — T3
`₺550 · hp180 · zırh air · hız2.6 · görüş12 · jammable0.8 · yakıt200`
- **Silah:** hassas-mühimmat 240×0.2 = 48 DPS (shaped), menzil12, acc0.90, cephane4
- **Etkin:** vs heavy **60** · vs light 51 · provides spotter · persistent(yakıt200)
- **KONUM:** ⚖️/💪 Kalıcı anti-armor + spotter (çift-değer). shaped → heavy'ye 60. Uzun-havada-kalış. Ama pahalı ₺550 + hp180 + **jammable0.8** + AA'ya ölür. **Dengeli çok-amaçlı** — hem vurur hem gözler; jammer/AA sayar. Kamikaze'nin pahalı-kalıcı kuzeni.

### 🟧 Kamikaze Drone (loitering_munition) — T2 ⭐ [aktif geliştirme]
`₺90 · hp80 · zırh air · hız3.6 · gizlilik0.5 · jammable**1.0** · yakıt60 · singleUse`
- **Silah:** çarpma-başlığı **260** (shaped, AoE1.5), **strike_top_armor**, tek-kullanım
- **Etkin:** vs heavy 260×1.4 = 364 · **üst-vuruşla ×2.2'ye kadar → ~800 tek-vuruş** heavy'ye
- **KONUM:** 🚩 **Drone-doktrininin çekirdeği.** ₺90'a heavy-üstünü 800'e kadar tek-vuruş = fiyatına göre EN yüksek anlık-anti-armor. AT-perde/tank temizleyici. **Yeni kontrol-modeli:** operatör-900px-bölgesinde kontrollü, dışında en-yakını-dal/5sn-bekle-patla, jammer boş-patlatır. DENGELEYEN: tek-kullanım + hp80 + **jammable1.0** (jammer tam-durdurur) + yakıt60 + 900px-menzil-kısıtı + operatör-gerektirir (₺240). Denge kilidi: ucuz+ölümcül AMA jammer/AA/kontrol-menzili ile net-karşıtlı.

---

## 8. KEŞİF ARACI + DESTEK (5 birim)

### 🟩 Keşif Aracı (scout_vehicle) — T1
`₺180 · hp220 · zırh light(2) · hız**3.2** · görüş14 · tespit0.6 · gizlilik0.5`
- **Silah:** makineli 12×2.0 = 24 DPS (small_arms, zayıf) · provides **spotter** · mark_target, stay_hidden
- **KONUM:** ⚖️ Hızlı kara-keşif/spotter. İHA'nın jamlanamayan kara-muadili (jammable değil!). Görüş14+hız3.2. Zayıf silah (kendini-savunma-değil-keşif). **Dengeli enabler** — kara-spotter + hedef-işaretleme. Jammer'a bağışık (İHA'ya göre avantaj).

### ⬛ EH Aracı / Jammer (ew_vehicle) — T3 [aktif]
`₺480 · hp300 · zırh light(2) · hız1.6 · tespit0.4`
- **Silahsız.** Aura: **jamming** (yarıçap11.43≈400px, uavControlLoss0.75, enemyAccuracy−0.20, enemyCommandRange−0.5, revealsSelf)
- **KONUM:** 🚩 **Anti-drone/anti-İHA aslı.** Jamming-alanında İHA/kamikaze kontrolü kopar (yeni: kontrol-dışı drone boş-patlar/donar) + düşman-isabeti−%20. Drone-doktrininin doğal karşıtı. Silahsız+emissions1.0 (ifşa) → korunmalı. **Denge-kilidi** — drone-meta'sına cevap; kamikaze/SİHA-spam'i bu dizginler. Karşıtı: kara-baskını (silahsız).

### 🟩 Sağlıkçı (medic) — T1
`₺160 · hp180 · silahsız` · Aura: heal (yarıçap3, 6hp/sn, yalnız infantry) · revive
- **KONUM:** ⚖️ Piyade-idamesi. Piyade-ağır orduda uzun-döğüş çevirir. Niş (yalnız infantry). **Dengeli destek** — kütle-piyade ile sinerjik, zırhlı-orduda gereksiz.

### 🟩 İstihkam (engineer) — T1
`₺200 · hp240 · zayıf-silah` · Aura: repair (8hp/sn, light+heavy) · **mayın, köprü, tahkimat**
- **KONUM:** ⚖️/💪 Çok-fonksiyon: zırh-tamiri + mayın + tahkimat + helo-üssü inşası. **Enabler/force-multiplier** — zırhlı-orduyu ayakta tutar, araziyi şekillendirir. Denge: dolaylı-değer (savaşmaz), doğru orduda yüksek getiri.

### 🟨 Drone Operatörü (drone_operator) — T2 ⭐ [aktif]
`₺240 · hp160 · zırh light(2) · hız1.6 · görüş11 · tespit0.3`
- **Silahsız.** payload: **2× kamikaze-drone** (reload25s) · launch_drone · emissions0.6
- **KONUM:** 🚩 **Drone-doktrininin platformu.** ₺240'a 2 kamikaze salar (ikmalle dolar) + **900px kontrol-bölgesi** merkezi. Saldıran: AT-perde temizler; savunan: mızrak vurur (simetrik doktrin). DENGELEYEN: silahsız + hp160 cam + jammer-karşıtı + drone-menzili 900px (operatör öne gelmeli → risk). **Yeni-meta birimi** — mezuniyette taarruzu 2/6→6/6 + savunmayı 3/6→5/6 çeviren kaldıraç.

---

## 9. LOJİSTİK + KOMUTA (2 birim)

### 🟧 İkmal Aracı (supply_truck) — T1
`₺250 · hp340 · zırh light(1) · hız1.8` · Aura: resupply (mühimmat1.0/sn + yakıt2.0/sn, yarıçap4) · **ölünce patlar (180 he, AoE3.5)** · kargo: mühimmat40/yakıt200
- **KONUM:** 🚩 **Yüksek-değerli hedef (HVT).** Topçu/ÇNRA/tank cephanesini + helo/drone yakıtını doldurur = uzun-döğüş enabler'ı. **Kara/mühimmat-only** (asker taşımaz — rol ayrımı). Ölünce patlaması (180 AoE) yakınına risk. **Denge:** kritik-enabler ama kırılgan+HVT → komando/kamikaze önce bunu avlar. Vurulunca ordu susar (mühimmat biter).

### 🟦 Komuta Aracı (command_vehicle) — T3
`₺600 · hp400 · zırh light(3)` · Aura: command (isabet+0.12, bastırma-direnci+0.25, yarıçap12, +rally) **UYGULANMIŞ ✓** · ölünce command_shock (12s felç) **ARTIK UYGULANMIŞ ✅** (yarıçap12'ye ×0.72 koordinesiz-ateş + bastırma-şoku) · call_cas
- **KONUM:** 🚩 **Force-multiplier HVT (SAHA-DÜZELTME UYGULANDI):** komuta-halesi (+%12 ordu-DPS/moral/rally) gerçek+güçlü. **command_shock ARTIK GERÇEK:** HQ ölünce yarıçap-12'deki dostlar 12sn koordinesiz-ateş (×0.72) + bastırma-şoku → "vurulursa ordu-felci" tezi ölçülebilir (COMMAND_SHOCK telemetri). Payoff-analizi: güçlü-hale ₺600'e dezavantajsızdı → şok onu **yüksek-risk-yüksek-getiri**ye çevirdi. Komando/kamikaze/derin-vuruş baş-hedefi.

---

## 10. ÇAPRAZ DENGE ANALİZİ

### Taş-Kağıt-Makas (ana çevrimler)
```
 zırh(Tank/TA) ──ezer──▶ piyade/light/hafif-araç
   ▲                                    │
   │ öldürür (shaped)                   │ ezer
   │                                    ▼
anti-armor(AT-timi/kamikaze/helo/SİHA)  ...
   ▲
   │ jamlar/önler
   │
EH-Aracı(jammer) + AA(SAM/SPAAG) ──vurur──▶ helo/İHA/drone

hava(helo/İHA/drone) ──öldürür──▶ AA-olmayan-kara
   ▲
   │ öldürür (sam/frag)
AA(SAM/SPAAG/MANPADS)
```
**Çevrim sağlam:** her baskın-birimin net-karşıtı var. Heavy→shaped, hava→AA, drone→jammer, indirect→radar+flank, HVT→raider.

### Fiyat-etkinlik aykırıları (analist-dikkat)
| Birim | Not |
|---|---|
| **SPAAG** ₺300 | 💪 Üç-rol (anti-hava+drone+piyade) tek-fiyata → **undercosted eğilimli**, en yüksek-değer AA |
| **Kamikaze** ₺90 | 🚩 heavy-üstüne ~800 tek-vuruş → jammer/kontrol-menzili DENGELEMEZSE aşırı; yeni-model dengeliyor |
| **AT-Timi** ₺170 | 🚩 heavy'ye 89-DPS/₺170 → meta-tanımlayıcı; cephane4+cam-hp dizginliyor |
| **Tank Avcısı** ₺420 | 🚩 menzil9-uzun + 78-86 AP-DPS + heavy-ön → çok-yönlü; yan/üst-cam + shaped-zayıf dengeliyor |
| **Taarruz Helo** ₺800 | 🚩 100-shaped-DPS + hız4.5 → AA-yoksa ezer; AA-varsa net-sayılır |
| **Balistik Füze** ₺1050 | 💪 **SAHA: 1.89 hasar/₺ = 2. verim** (gözcü-beslemeli alfa-kralı); "lüks" yalnız L≤6 dağınık-dünyada |
| **Komando** ₺320 | 💪 **SAHA-yıldızı** (6-öldürme sızma, HVT-söküm); mark/sabotage bağlanmadan bile |
| **ÇNRA** ₺650 | 🚩 **SAHA: en-istikrarlı katil** (4670 hasar/15-öldürme baskısız); "interceptable" SAHADA YOK (PD-eşiği>salvo) |

### Denge-endişesi işaretleri (analistin ham-maçta bakması için)
1. **SPAAG undercosted mı?** — Üç-rolü ₺300'e yapması → hava+piyade karışık orduda çok-değerli. Maç-telemetrisinde SPAAG-KIA-değeri/maliyeti oranına bak.
2. **AT-yoğunluğu → armor-ölü-meta:** Erime-analizi gösterdi ki bastırılmamış AT (AT-timi+Tank Avcısı) saldıran-armor'u siliyor. Drone-doktrini bunu dengeledi ama AT-taban-değeri (₺170) hâlâ düşük — armor'un cephe-değerini baskılıyor olabilir.
3. **Kamikaze/drone-operatör meta:** ₺90-kamikaze + ₺240-operatör = ucuz-ölümcül. Jammer (₺480) tek-karşıt; jammer-yoksa drone-spam dominant olabilir. Jammer-yoğunluğu vs drone-etkinliği ölç.
4. **Komuta/İkmal tek-nokta-kırılganlığı:** command_shock + supply-susması → bu HVT'lerin vurulma-sıklığı maçı belirliyor olabilir; raider-erişimi dengeyi kaydırır.

### Meta-duruş özeti (tier-benzeri, ROL-içi) — v2 saha-güncel
- **💪 Yüksek-değer:** SPAAG, Tank, Taarruz Helo, Tank Avcısı, İstihkam, **Balistik(gözcülü)**, **Komando(saha-yıldızı)**, **ÇNRA(istikrarlı-katil)**
- **🚩 Meta-tanımlayıcı (denge-kilidi):** AT-Timi, Kamikaze+Operatör, Jammer, İkmal(HVT)
- **⚖️ Sağlam-dengeli:** Piyade, Topçu, SAM, Keşif(İHA/araç), SİHA, Nakliye, Havan, Sağlıkçı, **Komuta(hale-güçlü/shock-yok)**
- **⚠️ Niş/uç veya rol-oynanmıyor:** MANPADS(niş), **ZMA(0.54 hasar/₺ — AI-rol-oynamıyor, stat-değil-görev)**

**Genel yargı (v2):** Roster **yapısal olarak dengeli** — her baskın-birimin net-karşıtı var, taş-kağıt-makas saha-tarihiyle bire bir örtüşüyor. **İki kağıt-only mekanik** (ÇNRA-intercept, command_shock) düzeltildi/karar-bekliyor. İzlenecek 4 nokta (SPAAG-fiyatı, AT-bastırma, drone↔jammer, HVT-kırılganlığı) — 3'ü artık yeni telemetriyle **ölçülebilir**. Bunlar "kırık" değil **ayar/uygulama-adayı**; drone-kontrol-modeli sahada **sıfır-veri** (ilk jammer'lı maçlar belirleyici).

---
*Rapor tabanı: units-modern.json (=UnitData.js ayna). Durumsal çarpanlar (tech/komuta-halesi/veteranlık/zırh-yüzeyi/isabet-menzil-düşüşü) hariç taban-değerler. Etkin-DPS = hasar×rof×taban-isabet×hasar-matrisi.*
