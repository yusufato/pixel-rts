# Düello Derinleştirme + His — Master Plan

> 3 paralel araştırma sentezi (2026-06-27): kod-denetimi (5 alt-sistem) + gerçek-dünya 20 savaş dinamiği (61+ kaynak) + görsel-şölen 15 öğe.
> İlke: **derinlik HEM mekanik HEM görsel HEM beyin-girdisi olmalı** (3 filtre: görünür / beyin-algılar / deterministik).
> Sıralama kuralı: **sim'i değiştiren her şey EĞİTİMDEN ÖNCE kilitlenir** (beyin sim'i öğrenir). **Render-only his her zaman yapılabilir** ve combat-depth'i tune etmeye yardım eder (göremezsen ayarlayamazsın).

---

## BÖLÜM 1 — 20 gerçek savaş dinamiği × bizdeki durum

✅ VAR · 🟡 KISMİ · ❌ YOK

| # | Dinamik | Bizde | Durum / eksik | Katman |
|---|---------|:---:|------|:---:|
| 1 | Bastırma/pinning | ✅ | 0-100 var (Unit.js:81,342,507); "pinned" sabit-durum + isabet düşüşü eksik | T1 |
| 2 | Moral & bozgun çağlayanı | ✅ | panik+bozgun var (Unit.js:135-183); kazanma-koşulu + kuşatma→teslim yapılmalı | T1 |
| 3 | Kuvvet yoğunlaşması (Lanchester) | ✅ | odak-ateş kare-yasayı doğuruyor; overcrowding-azalan-verim eklenebilir | hazır |
| 4 | Kanat & yönelim | ✅* | facingAngle (Unit.js:60,252,263) + arka-vuruş 2× (519-528) VAR ama ÇİZİLMİYOR; yan-ark+yönlü-zırh+moral eksik | **T0+T1** |
| 5 | Ateş & manevra | 🟡 | #1+#4'ten doğar → beyin öğrenir | beyin |
| 6 | Birleşik-silah counter | ✅ | anti-tank 4× vs zırh (globals.js:296-319) | hazır |
| 7 | Sis & tespit (optik/gizlilik) | 🟡 | sis+görüş var; arazi LOS engellemiyor, ateş-edince-görünme yok | T1/T2 |
| 8 | Arazi: cover/gizlenme/YÜKSELTİ | 🟡❌ | orman/dağ/siper var; **YÜKSELTİ HİÇ YOK**; cover≠concealment ayrımı yok | **T2** |
| 9 | Kuşatma & sabitle-kanatla | 🟡 | facing var; "kesilince moral çöküşü/teslim" yok | T2 |
| 10 | Baskın & pusu | ❌ | gizlen→ateşle→açığa-çık yok | T3 |
| 11 | Darboğaz & engeller | 🟡 | dağ yumuşak engel; su kullanılmıyor (terrainData.js); mayın/tel yok | T3 |
| 12 | Yedekler & zamanlama | ✅ | komutanda RESERVE rolü var | beyin |
| 13 | Schwerpunkt & kuvvet ekonomisi | ✅ | Foresight Schwerpunkt hesaplıyor | hazır |
| 14 | Topçu (savaşın kralı) | ✅* | splash var ama **gözcü/LOS gerektirmiyor** (Unit.js:532) → all-arty kökü | T1 |
| 15 | Keşif-çekişi / parça-parça yenme | 🟡 | recon görüşü var; boşluk-tespiti yok | T3 |
| 16 | Tahkimat & siperlenme | ✅ | siper+istihkam (SIM.trenches globals.js:385) | hazır |
| 17 | Cephe-genişliği & derinlik | ❌ | aşırı-yayılma boşluğu mekaniği yok | T3 |
| 18 | Tempo & OODA / C2 sürtünmesi | ❌ | komut-gecikmesi yok | T3 |
| 19 | Liderlik & veteranlık | 🟡 | veteranlık (xpBonus) var; subay-aura/dekapitasyon yok | T2 |
| 20 | Lojistik & ikmal / kümülasyon | 🟡 | yerel ikmal var; hat-mesafesi/kümülasyon yok | T3 |

**Manşet:** en belirleyici 6 dinamiğin 5'i zaten VAR. "4-5× derinlik" = görünür-yap + 4 yarımı güçlendir + birkaç gerçek boşluk ekle.

---

## BÖLÜM 2 — 15 görsel his-öğesi (insanlar bunu görmeyi sever)

Tümü render-only, `SIM.headless` ile eğitimden izole. Mevcut seam: gameLoop main.js:952, stepSim:982, draw 993-1004; screenShake globals.js:188-191 (worldToScreen:240); craters[] globals.js:391 (main.js:618); particles[] UNCAPPED.

| # | Öğe | Emek | Ne / kanvas-nasıl |
|---|-----|:---:|------|
| 1 | **Hit-flash** (beyaz tint) | ucuz | hasar alınca 2-3 kare beyaz; 12px sprite'ta bile "değdi" sinyali. source-atop fillRect |
| 2 | **Trauma screen-shake** (kare+noise) | ucuz | linear-random yerine trauma²·smoothed-noise; tüfek vs nuke kategorik fark |
| 3 | **Hit-stop** (darbe donması) | ucuz | önemli vuruşta 2-8 kare stepSim atla (render sürer); per-entity freezeUntil |
| 4 | **Knockback+recoil** (visualOffset) | ucuz | render-only {x,y} offset, geri-tepme+itme; pathfinding bozulmaz |
| 5 | **Savaş-alanı kalıcılığı** (baked ground) | orta | ceset/kan/scorch tek offscreen canvas'a STAMP → 500 decal = 1 drawImage; nerede kıyamet koptuğunu okutur |
| 6 | **Moral banner** (rout/break) | ucuz | birlik-üstü bayrak yeşil→sarı→beyaz→kaçış; birimler haritadan kaçar; çağlayan |
| 7 | **Sinematik auto-kamera** (slow-mo+zoom) | orta | belirleyici anlarda timeScale 0.15-0.3 + zoom 1.6×; her şeyi çarpan; klipленir |
| 8 | **Çok-fazlı patlama** (flash→ateş→duman→pus) | orta | tek puf yerine sahneli olay; additive ateş + yükselen duman + scorch decal |
| 9 | **Additive glow** (sıcak VFX) | ucuz | ateş/namlu/tracer/kıvılcım 'lighter' blend → parlama; particle bütçesi şart |
| 10 | **Tracer + arklı mermi** (gölgeli) | orta | mermi=parlak çizgi (1/4 tracer); topçu=arklı + yer-gölgesi → "geliyor!" telegraph |
| 11 | **Squash&stretch + easing** | orta | vuruş/iniş/ateşte scaleX/Y; her şey yaylanır, canlı hisseder |
| 12 | **Durum telegraph** (ateş/reload/kaçış) + rozet | orta | poz + 3px renkli rozet (sarı=bastırılmış, kırmızı=pinned); "kim kazanıyor" okunur |
| 13 | **Hasar sayıları** (throttled) | ucuz | yükselen pop; crit büyük; kitle-savaşta AGGREGATE + zoom'da gizle |
| 14 | **Şarj çarpışması** (impact şoku) | orta | temas: ön-saf sprite'ları savrul + toz + kamera-kick + per-sprite hit-stop |
| 15 | **Kütle & yoğunluk LOD** | orta | yoğun küme + Y-sort derinlik; zoom-out'ta 2-3px nokta → 2000-blob "ordu" |

**Görsel inşa sırası (araştırma önerisi):** impact-triad (1-4, ucuz, 1 günde hissi değiştirir) → baked-ground (5, kalıcılık+aftermath açar) → auto-kamera (7, çarpan) → spectacle/readability.

**Çizim katmanı disiplini:** ground+decal → kontrol-nokta → birim(+outline) → rozet/banner/can-barı → particle → seçim/emir → sis/UI. Okunabilirlik katmanı (rozet/banner/sayı) **shake'in ÜSTÜNDE** olmalı (kamera sallanırken bile okunur).

---

## BÖLÜM 3 — 8 "amplify edilecek an" (auto-kamera tetikleyici)

1. **Belirleyici darbe / dönüm:** ordu-değerini +'dan −'a geçiren ölüm → 150-350ms slow-mo + zoom + flash. Maç başına 1 kez.
2. **Mükemmel kuşatma (Cannae):** kümeyi >270° saran arka-ark saldırı → animasyonlu "ilmik" poligon + flank-çarpanı + dışarı-desatüre + "SARILDI!" banner.
3. **Bozgun & kovalama:** moral-eşiği aşılınca FLEEING → komşulara moral-drain pulse → kaçış-anim + panik "!" + kovalama-bonusu + arttan-vuruş partikülleri.
4. **Kahramanca son direniş:** >3:1 kuşatılmış hâlâ sağ → aura/spotlight + vignette + kill-sayacı + son-vuruşta slow-mo; sağ kalırsa "HAT TUTULDU".
5. **Kahraman katliamı:** birim kill-sayacı 3/5/8 → her kademe daha gür flash/shake + "KILLING SPREE x7".
6. **Zincir patlama:** patlayıcı ölüm → komşu patlayıcıları ateşler (queue) → additive-yığılan shake + 50-80ms hit-stop + scorch decal.
7. **Zamanlı takviye (süvari geldi):** yenilgi-eşiği + takviye kameraya GİRİNCE → banner+boru + zoom-out reveal + şarj-bonusu ilk-temas.
8. **Underdog dönüşü:** ordu-oranı %35'in altına düşüp %55 üstüne çıkıp kazanırsa → düşük-noktada kalp-atışı+vignette, sonra renk-dönüşü + "COMEBACK" damgası.

> Dikkat: bu anların ÇOĞU = Bölüm-1 dinamiklerinin görsel hâli. Kuşatma=#9, bozgun=#2, son-direniş=#16/#19, takviye=#12. **Mekanik + görsel aynı madalyonun iki yüzü.**

---

## BÖLÜM 4 — BİRLEŞİK YOL HARİTASI (mekanik + görsel + beyin-girdi eşleşik)

**Faz V0 — His temeli (render-only, sim'e dokunmaz, eğitimi etkilemez):**
- Rotation render (Unit.js:701 sprite'ı ctx.save/translate/rotate/restore ile sar) → #4'ü GÖRÜNÜR yapar
- Impact-triad: hit-flash + trauma-shake + hit-stop + knockback (visualOffset)
- Baked-ground (ceset/kan/scorch) + çok-fazlı patlama + additive-glow + tracer/arklı-mermi
- Durum-rozeti + moral-banner + hasar-sayısı (okunabilirlik)
- Auto-kamera + amplify-anları
- → Mevcut DERİN combat'ı anında "vay be" yapar + combat-depth'i tune etmek için GÖRÜNÜR kılar

**Faz T1 — Mevcut 4 yarımı güçlendir (SİM — eğitimden önce kilit):**
- Bastırma → "pinned" sabit-durum + isabet/accuracy düşüşü (#1) · görsel: kırmızı rozet, yere-yatış pozu · girdi: kendi+hedef bastırma
- Kanat → yan-ark + yönlü-zırh + flank'ta moral cezası (#4) · görsel: rotation+rear-flash · girdi: flanked-mıyım/hedef-flanked
- Topçu → gözcü/LOS zorunlu + min-menzil + dispersion (#14) — all-arty'yi dengeler · görsel: arklı-mermi+gölge · girdi: LOS/gözcü var-mı
- Sis → arazi LOS'u engeller + ateş-edince-görünür (#7) · girdi: görünür/gizli durumu

**Faz T2 — Gerçek boşluklar (SİM — eğitimden önce kilit):**
- **YÜKSELTİ** (#8): per-tile elevation 0-3 → yüksek-zemin menzil/görüş/savunma + yokuş-yukarı cezası · görsel: gölge/yükseklik · girdi: yükseltim vs hedef
- Kuşatma → moral-çöküş/teslim (#9) · görsel: "ilmik" + SARILDI · girdi: kuşatılma-derecesi
- **Takviye dalgaları** (10-15dk maç): periyodik front-replenish (match-length fix) · görsel: süvari-geldi anı
- Subay-aura + dekapitasyon (#19) · görsel: aura · girdi: lider-yakın-mı

**Faz LOCK → EĞİTİM:** sim donar → BrainState.js (girdi ~350) → entegrasyon → Node-sim env → behavior-cloning → PPO+GPU → diğer PC gece-eğitim.

**Faz T3 (eğitim sonrası / v2):** pusu, darboğaz/su, cephe-genişliği, tempo/C2, lojistik-hattı, keşif-çekişi.

---

## BÖLÜM 5 — Harita-hissi (kullanıcı notu: "harita iyi ama his bakımından zayıf")
Harita 2D pixel-art olarak zenginleştirilecek (V0/T2 ile paralel): arazi-detayı (çim/çamur/yol dokuları), savaş-izi (baked-ground decal'ları haritaya işler), yükselti görselleştirme (T2), atmosfer (toz/ışık). İş bölümü: **kullanıcı sprite/doku çizer, ben canvas-VFX + entegrasyon + harita-render kodlar.**

## BÖLÜM 6 — Determinizm & eğitim güvenliği
- Tüm juice `SIM.headless` korumalı → training rollout'larında çalışmaz → throughput/determinizm etkilenmez.
- facingAngle zaten atan2 kullanıyor (sim'de mevcut) → aynı-motor lockstep güvenli; cross-engine MP istenirse de-transcendental gerekir (NN'den ayrı iş).
- Yeni sim-mekaniği rastgelelik gerektiriyorsa sim-RNG (srand/mulberry32) kullan, Math.random DEĞİL.
