# Intel 4 Pro — "Son Koz" Planı

> **Amaç:** intel4'ü intel3pro'ya karşı kararlı biçimde üstün kılmak. Metodoloji sabit: *"selefini yenemeyen sürüm yayınlanmaz."*
>
> **⚠️ 2026-08-03 DENETİMİ:** Bu belge uzun süre güncellenmedi; önceki oturumlar işi yaptı ama planı işaretlemedi. Aşağıdaki durumlar **kodun kendisine ve taze ölçüme karşı doğrulandı** (dosya:satır kanıtıyla). Bir daha bayatlamaması için: **bir madde bitince bu belge aynı commit'te güncellenir.**

---

## ÖLÇÜM TEZGÂHLARI

| Komut | Ne yapar | Maliyet |
|---|---|---|
| `--intel4exam` | Planın 4 tohumu (2 saldırı + 2 savunma, 6500₺). Galibiyet + FAZ-0/FAZ-1 kabulleri + duruş/gerekçe histogramı. | ~15 dk, JSON yazmaz |
| `--intel4selfplay` | 16 tohum × 2 rol = 32 ayna maçı (intel4 vs intel4). Sistemik zaaf çıkarımı. | uzun, arka planda |
| `--vstournament` | Mezuniyet kapısı: 12 maç, rol-takası + handikap + ayna. | ~35 dk |
| `--vsrec` | Analist ham kaydı (4 maç, **145 MB JSON**). Yalnız derin analiz gerekince. | uzun + disk |

**Determinizm sözleşmesi (değişmedi):** yeni davranış `BATTLE_INTEL4_DELTAS` anahtarı arkasında; yeni sim-state → hash + fork + replay AUDIT. Kapılar: `--forktest` `--liverepro` `--defertest` `--defersoak` `--pdtest`.

### ⚠️ KONFİGÜRASYON AYRIŞMASI (dikkat — ölçümleri yanıltır)
`BATTLE_INTEL4_DELTAS` varsayılanı ([globals.js:368](../js/globals.js#L368)):
`stance:✓ shock:✓ deblob:✓ helo:✓ comp:✓ micro:✓ attack:✓ | profile:✗ drone:✗ defense:✗ backbone:✗ range:✗`

- **Gerçek oyun (interaktif):** [main.js:494](../js/main.js#L494) ek olarak `defense + range + drone` AÇAR.
- **`--vsrec` / `--intel4exam`:** **TÜM** deltaları açar — `backbone` dahil, ki 5000₺'de **net zararlı** ölçülmüştü (2/4→0/4).
- **`--vstournament`:** varsayılanları kullanır (`--attack` bayrağı hariç).

→ Üç tezgâh **üç farklı beyni** ölçüyor. Bir sonuç raporlanırken hangi konfigürasyon olduğu **mutlaka** yazılmalı.

---

## DURUM (2026-08-03, `--intel4exam`, tüm-deltalar açık)

**intel4 = 3/4.** *(Belgenin eski "0/4 kaybediyor" satırı bayattı; plan sıralaması o yanlış öncüle göre kurulmuştu.)*

| Maç | Sonuç | İlk STRIKE | Duruş dağılımı (saldıran) |
|---|---|---|---|
| saldırı seed2024 | **KAZANDI** 18-0 | t=41.6s (`yumusatma-hazir`) | SHAPE 1180 + POSITION 420 → STRIKE 5700 |
| saldırı seed777 | **KAYBETTİ** 0-19 | t=17.1s (`yumusatma-hazir`, ömrü 90 tik) | SHAPE 340 → **STRIKE 6960 (%95)** |
| savunma seed2024 | **KAZANDI** 22-0 | — (saldıran intel3pro, t=100.6s) | — |
| savunma seed777 | **KAZANDI** 19-0 | — (saldıran intel3pro, t=100.6s) | — |

**Tek kaybın imzası:** t=17'de kısa ömürlü bir yumuşatma okumasıyla STRIKE açılıyor, sonra `urgency-commit` (2580 tik) + `urgency-t150` (4290 tik) latch'i bir daha bırakmıyor → ordu hiç yeniden şekillenmeden eriyor. Kazanan maçta ise gerçek şekillendirme (SHAPE+POSITION 1600 tik) var. **TEK TOHUM — nedensellik için ikinci kanıt gerekir.**

---

## FAZ DURUMLARI (koda karşı doğrulandı)

### FAZ 0 — Kilit yamaları · **%90 BİTTİ**
- ✅ **Kuvvet-oranı vetosu kaldırıldı.** [BattleSituation.js:184](../js/BattleSituation.js#L184) — `commitBroken` yalnız iptal-kriterlerinden oluşuyor (`!ammoOK || consolidate || losing || !hasContactGraced || lossAbort`), oran yok. *Belge bunu "KALDI" diyordu — yanlış.*
- ✅ **Asgari kalış (dwell).** `STRIKE_DWELL = 320` tik ≈ 16s ([BattleSituation.js:79](../js/BattleSituation.js#L79)) — planın "15-20 sn" şartını karşılıyor.
- ✅ **KABUL ÖLÇÜLDÜ: tek-tik devrilme = 0** (4 maçın hepsinde). Duruş geçişi 1-9 arası → osilasyon bitmiş.
- ❌ **KALAN: şok-sömürüde `t<15s` korkuluğu yok.** [BattleSituation.js:120](../js/BattleSituation.js#L120) `shock` tetiğinde zaman şartı bulunmuyor. *Ama ölçülen erken-STRIKE şoktan değil `yumusatma-hazir`'dan geliyor → korkuluk şok yerine **kısa-ömürlü-gerekçe** üstüne kurulmalı.*

### FAZ 1 — Operasyon nesnesi · **BÜYÜK ÖLÇÜDE BİTTİ**
- ✅ Operasyon evreleri gerçek: `ASSEMBLE / FIRE_WINDOW / ASSAULT / EXPLOIT` + evre zaman-aşımları ([BattleExecution.js:20-28](../js/BattleExecution.js#L20)); `taskExecutor.operationHistory` gerekçeli geçiş kaydı tutuyor (`COMBAT_GROUPS_READY`, `FIRE_WINDOW_EXPIRED`, `ASSAULT_MOMENTUM`, `MISSION_TIME_CRITICAL`…).
- ✅ **KABUL ÖLÇÜLDÜ: ilk STRIKE ≤ t=90s** (41.6s ve 17.1s).
- ❌ **KALAN:** "STRIKE'tan geri dönüşlerin %100'ü kayıtlı iptal-kriteri gerekçesi taşır" ölçülmedi. (`--intel4exam` gerekçe histogramı tutuyor; geri-dönüş gerekçesi ayrıca sayılmalı.)

### FAZ 2 — Görev/rol sistemi · **KISMEN**
- ✅ Rol sistemi var: `TASK_GROUP_ROLE` = MAIN / FIXING / **FLANK** / FIRE_SUPPORT / RECON / SUPPORT / RESERVE ([BattlePlanning.js:4](../js/BattlePlanning.js#L4)).
- ✅ Omurga-tabanı `backbone`-delta yazılmış ([BattleDeployment.js:383](../js/BattleDeployment.js#L383)) — **ama varsayılan KAPALI**, 5000₺'de net zararlı ölçülmüş (bütçe-adaptif olana dek kapalı).
- ❌ **KALAN:** kabul metrikleri (maç-başı kayıp ~820₺ bandı, kamikaze başına ≥150₺ imha, HVT-sağkalım) **hiç ölçülmedi**. `battleBalanceReport()` bu verileri zaten üretiyor → self-play taramasında toplanacak.

### FAZ 3 — Savunma yerleşimi · **YAZILDI, ÖLÇÜLMEDİ**
- ✅ `defense`-delta gerçek: tam-cephe garnizon ([BattleExecution.js:111](../js/BattleExecution.js#L111)), XWIDE savunma yerleşimi ([BattlePlanning.js:629,733](../js/BattlePlanning.js#L629)). İnteraktif oyunda AÇIK.
- ✅ **KABUL (kısmi) GEÇTİ: "en az bir savunma galibiyeti"** → 2/2 savunma maçı kazanıldı.
- ❌ **KALAN:** "t=20'de yerel-tepe L≤8" ölçülmedi. `BATTLE_BALANCE.localDensity` sayacı var ama rapora bağlanmamış.

### FAZ 4 — Damıtılmış oyuncu politikaları · **KISMEN**
- ✅ **R1 (angajman mesafesi)** = `range`-delta: menzil ≥520 olan birim STRIKE'ta bile 0.9×menzilde durur ([Unit.js:1270](../js/Unit.js#L1270)). İnteraktif oyunda AÇIK, varsayılan KAPALI.
- ⚠️ **R2 (hedef önceliği)** ve **R3 (SEAD sıralaması)**: `drone`-delta (av-paketi→HVT) var ama R2'nin "ilk-90sn %55 hasar düşman-HATTINA" kuralı ve R3'ün ortak SEAD görevi kod olarak **doğrulanamadı**.
- ❌ **KALAN:** kabul metriği (ort. angajman menzili ≥900, dolaylı+hava payı ≥%50) ölçülmedi.

### FAZ 5 — Sınav · **AÇIK**
- Eski dörtte **3/4** (hedef 4-0). Yeni 4 tohum hiç denenmedi.

---

## GÜNCELLENMİŞ SIRA (öncül değişti → yeniden önceliklendirildi)

Eski sıra "0/4 kaybediyoruz, savunma Suçlu-2" varsayımına dayanıyordu. Gerçek: **savunma 2/2 kazanıyor, tek kayıp bir SALDIRI maçı.**

1. **Ayna self-play taraması** (`--intel4selfplay`, 16 tohum × 2 rol) → sistemik zaafları tek tohum anekdotundan değil 32 maçtan çıkar. **← ŞİMDİ**
2. **FAZ 2/3/4 kabul metriklerini rapora bağla** (kayıp₺/maç, kamikaze₺, yerel-yoğunluk L, ort. menzil). Ölçmeden iyileştirme yok.
3. **Erken-STRIKE latch'i** (FAZ 0 kalanı): kısa ömürlü gerekçe latch'lememeli. Tek kaybın tek ayırt edici imzası — ama self-play doğrulamadan dokunma.
4. FAZ 1 kalanı (gerekçesiz geri-dönüş = 0 sınaması).
5. FAZ 5 sınavı: eski 4 + yeni 4 tohum.

**Kilitli kararlar (kullanıcı, değişmedi):** iptal-kriteri role-göre dinamik · ihtiyat oranı tehdit-profiline göre dinamik · FAZ 4 damıtması tüm 15+ kayıttan.

İlgili: [[pixel-rts-intel4-pro-taban]] · [[pixel-rts-operasyonel-durus]] · [[pixel-rts-tehdit-profili]] · [[pixel-rts-oyuncu-profili]] · [[pixel-rts-sektor-komuta]] · [[pixel-rts-teknik-borc]]
