# Intel 4 Pro — "Son Koz" Planı (6 faz, her biri sınanabilir)

> **Amaç:** intel4'ü intel3pro'ya karşı kararlı biçimde üstün kılmak. Metodoloji sabit: *"selefini yenemeyen sürüm yayınlanmaz."* Ölçüm-tezgâhı `--vsrec` (4 tohum: 2 saldırı + 2 savunma, seed 2024/777) + `--vstournament` (rol-takası + handikap + ayna). Ham kayıtlar `INTEL3PRO-vs-INTEL4-analiste/` (her build'de güncellenir).
>
> **Durum (2026-08):** intel4, intel3pro'ya **0/4** kaybediyor (saldırıda RED imha, savunmada attacker_dominant). forceRatio POLARİZE (910 tik<0.35-umutsuz vs 1217≥1.15) = **rout imzası** — intel4-ordusu STRIKE'a gelmeden kaybeden-orana düşüyor. Teşhis: STRIKE-askısı SEMPTOM, hastalık YUKARIDA (savunma-kampı/blob + kamikaze-israfı + görevsiz-alım).
>
> **Determinizm/gating sözleşmesi (her fazda):** yeni-davranış `BATTLE_INTEL4_DELTAS` anahtarı arkasında (default-false → byte-aynı, intel3pro/flag-off etkilenmez). Yeni sim-state → hash+snapshot+fork AUDIT. Her fazdan sonra `--snaptest ×2` byte-aynı + ara-sınav (`--vsrec` 4-tohum, bedava/deterministik) → ilerleme eğrisini faz-faz gör.

---

## KİLİTLİ KARARLAR (kullanıcı, 2026-08)
1. **Operasyon iptal kriteri** (taarruz hangi kayıp eşiğinde bozulur): **Dinamik — role göre** (perde erken feda-edilir yüksek-eşik; ana-çaba düşük-eşik; av-paketi HVT-imha-edince/bağ-kopunca).
2. **İhtiyat oranı** (bütçenin %'si): **Dinamik — tehdit profiline göre** (yüksek-tehdit-belirsizlik → büyük ihtiyat; net-üstünlük → küçük).
3. **Faz 4 damıtması hangi kayıtlardan**: **Tüm 15+ kayıt** (10 oyuncu-maçı damıtıldı bile — aşağıda R1-R3).

---

## FAZ 0 — Kilit yamaları (en ucuz, en acil)
- **urgency-STRIKE açıldığında kuvvet-oranı vetosu DEVRE DIŞI** — askıya-alma yalnız *iptal-kriteriyle* (mühimmat-bitişi / doruk-konsolide / temas-yok). *Mevcut commit-latch'te `URGENCY_ABORT_RATIO=0.35` FLOOR'u analistin spec'ine göre KALDIRILMALI (yalnız iptal-kriteri kırsın).*
- **şok-sömürü'ye `t<15s` korkuluğu** (t=0 algı-init spike'ı sahte-şok üretmesin) **+ 15-20 sn asgari kalış** (şok-STRIKE'ı erken çökertme).
- **Kabul:** aynı 4 tohumda **tek-tik devrilme sayısı = 0** (STRIKE→POSITION→STRIKE 1-tiklik osilasyon yok).
- **Analist bahsi:** yalnız bu faz bile **0-4'ü 2-2'ye** çekebilir.
- **DURUM:** commit-latch YAPILDI (`BattleSituation.js`, det ✓, 509 urgency-commit tiki) ama floor-kaldırma + şok-korkuluğu + tek-tik-devrilme=0 sınaması KALDI.

## FAZ 1 — Operasyon nesnesi (Plan)
`Plan = { eksen (weakestEnemySector'dan), evreler: hazırlık→yürüyüş→taarruz→konsolide, evre-azami-süreleri, görev-atamaları, iptal-kriterleri }`.
- **Temel ilke:** anlık-okumalar planı DEVİREMEZ — yalnız *iptal-kriterleri* devirebilir. (Stance-osilasyonunun kökten çözümü: plan kalıcı nesne, tik-tik-okuma değil.)
- **Kabul:** taarruzda ilk STRIKE **≤ t=90**; STRIKE'tan geri-dönüşlerin **%100'ü kayıtlı bir iptal-kriteri gerekçesi** taşır (gerekçesiz-devrilme=bug).

## FAZ 2 — Görev/rol sistemi  ← **BAŞLADI: jeneratör-omurga-tabanı (kök-neden)**
Gruplar: **perde / ateş / av-paketi / ihtiyat / HVT-koruma**. Doktrin-cümleleri KURAL olarak:
- ana-çabanın ucu **asla çıplak piyade değil**;
- **av-paketi (kamikaze/komando) yalnız `threatProfile`'daki HVT'lere**;
- **ihtiyat yalnız şok-sömürü VEYA kriz-yamama** ile harcanır.
- **Kabul (revize, aşağıdaki (d) ile):** kayıp-bölünme yerine → **maç-başı toplam kayıp ₺** (hedef ~820₺/maç bandına in, AI şu-an 3500-5000) **+ HVT-sağkalım oranı**. Kamikaze başına imha **≥150₺**.

**MAÇ-KANITI (savunma-seed777, analist):** intel4 = 5 kamikaze + EW = **930₺ pahalı oyuncak**, HAT yalnız **2 piyade** → toplam 1-2 öldürme üretti. Kırmızının cevabı yeni-numara değil: **700₺ tek-SAM + 920₺ zırh-çifti (TD+MBT)**. *Pahalı asimetrik yatırım, ucuz simetrik cevaba yenildi.* İLAÇ = **jeneratör kategori-tabanı: hat+AT karması ≥ %30 bütçe** (`comp`-floor imza-garantiler ama hattı aç-bırakıyor — omurgayı imza-oyuncak için takas ediyor). Omurga = `[ARMOR, INFANTRY, MECH_INFANTRY, ARMOR_INFANTRY, ANTI_TANK]`. `backbone`-delta (default-false), her iki-tarafa (saldıran+savunan). **Perde-rolü bilinçli:** kırmızının ZMA-feda oyunu (perde-arkasında-zırh) = Faz2 perde rolünün doğal sonucu → intel4 aynı numarayı yapabilmeli.

## FAZ 3 — Savunma yerleşimi  ← **ÖNCELİK (Suçlu-2, 3-sürümlük borç)**
Sektör-garnizonları + `dig_in` + **L≤6 yerel-tavan** + **SAM-şemsiye kuralı** (kritik-varlıkların ≥%70'i zarf-içinde) + **ihtiyat geride**.
- **Kök-sorun:** sektör/tehdit verisi kararlarda VAR ama savunma-KONUŞLANMASINA bağlı değil → t=20'de L=22 (yirmi-iki birim tek aoe600 çemberinde!) → zırh-mızrağı altında 1 birime erir.
- **Kabul:** savunma-maçlarında **t=20 yerel-tepe L≤8** ve **en az bir savunma galibiyeti**.

## FAZ 4 — Damıtılmış oyuncu politikaları (saf-kural, öğrenen-bileşen YOK)
Kullanıcının oyunu üç sabit tabloya damıtılır (10 maç damıtıldı, tüm 15+ ile genişler):
- **(a) R1 — Angajman mesafesi:** `tercih_edilen_menzil = kendi_azami × 0.9`. Her sınıf azami-menzilinin **%85-96'sında** ateşliyor (ÇNRA 1794/1950, havan 789/900, helo 864/900, AT 522/525, MBT 428/450, piyade 296/300, balistik asgari-menzil-sınırında 2007). AI'ın 300-600 ortalamalarıyla arasındaki TÜM fark bu tek-satır.
- **(b) R2 — Hedef önceliği (evreye bağlı):** ilk-90sn hasarın **%55'i düşman-HATTINA** (perde-törpüleme), HVT değil; destek/lojistik-avı ORTA-oyun (tam-maçta %8+%5, ilk-90sn %1). AA'ya toplam hasarın yalnız **%9'u** → hava-savunmasını DÖVEREK değil, **cerrahi-vuruşla (kamikaze/balistik/helo tek-atış) SÖK-İMHA et**.
- **(c) R3 — SEAD sıralaması:** hava-serbestisi SEAD'i BEKLEMEZ — zarf-farkındalık-şartıyla **erken uçar** (ilk-atış t=30-61), AA-sökümü **hava+drone ORTAK görevi** (son-AA-imhası t=117-240). 8. maçtaki hava_ilk=125 = bilinçli-bekletme (kural değil, seçenek).
- **Kabul:** AI standoff-doktrini çektiğinde stil-parmak-izi **ort.menzil ≥900** ve **dolaylı+hava payı ≥%50**.
- **(d) Kayıp-imzası düzeltmesi:** 80/20 YANLIŞ — ucuz/pahalı bölünme **52/48**. Asıl-imza HACİM: 10-maç 8220₺ = **~820₺/maç (bütçenin %16'sı)**; AI 3500-5000₺/maç. Faz-2 metriği buna göre revize (yukarı).

## FAZ 5 — 4-0 sınavı
Aynı 4 tohum + **4 YENİ tohum** (aşırı-uyum sigortası; 4-bilinen-maça ezberlenmiş 4-0 = sınav değil ezber).
- **Kapanış şartı:** eski-dörtte **4-0** ve yenilerde **≥3-1**.
- Her fazdan sonra **ara-sınav** koş (deterministik/bedava) → ilerleme eğrisi faz-faz görünür.

---

## Sıra
FAZ 0 (kilit-yaması, cheap, kısmen-yapıldı) → **FAZ 3 (savunma-yerleşimi = kullanıcı-önceliği, Suçlu-2)** → FAZ 1 (operasyon-nesnesi) → FAZ 2 (rol-sistemi) → FAZ 4 (damıtılmış-politika) → FAZ 5 (4-0 sınavı). Her faz bağımsız-teslim + gated + det-korumalı + ara-sınavlı.

İlgili: [[pixel-rts-operasyonel-durus]] (STRIKE-kapı + commit-latch) · [[pixel-rts-tehdit-profili]] (threatProfile HVT + flag-sistemi) · [[pixel-rts-oyuncu-profili]] (D-profili) · [[pixel-rts-sektor-komuta]] (anti-blob offense, savunmaya taşınacak) · [[pixel-rts-drone-operator]] (av-paketi mekaniği)
