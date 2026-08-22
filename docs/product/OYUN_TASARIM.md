# PIXEL RTS — OYUN TASARIM BELGESİ

> Saf vanilla JS + Canvas, tarayıcı-içi, NODE/build/GPU YOK, tek-dosya HTML dağıtılabilir (~9000 satır çekirdek).
> Felsefe: **KUVVET EKONOMİSİ** — en az kayıpla en fazla hasar. AI **HİLESİZ** (yalnız sis-içini görür) yetenekli insanı yenmeli.
> Bu belge, mimari sentez + adversarial kritiğin (genom-uzayı çatlağı, sahne-state sızıntısı, sahte-karar riski) birleşik halidir.

---

## İÇİNDEKİLER

1. [Vizyon & Tür](#1-vizyon--tür)
2. [Düello Finali: İnsan-Yener AI Doktrini](#2-düello-finali-i̇nsan-yener-ai-doktrini)
3. [Eğitim Planı (İnsan-Yener Beyin)](#3-eğitim-planı-i̇nsan-yener-beyin)
4. [Genel Yapı: Dünya / Ekonomi / Çekirdek Döngü](#4-genel-yapı-dünya--ekonomi--çekirdek-döngü)
5. [MVP Meta-Oyun (3-Düğüm Dikey Dilim)](#5-mvp-meta-oyun-3-düğüm-dikey-dilim)
6. [Fazlı Yol Haritası](#6-fazlı-yol-haritası)
7. [Fizibilite, Riskler & Kapsam Disiplini](#7-fizibilite-riskler--kapsam-disiplini)
8. [Kullanıcıya Açık Sorular](#8-kullanıcıya-açık-sorular)

---

## 1. VİZYON & TÜR

### 1.1 İki Katmanlı Vizyon

Pixel RTS, **iki katmanlı** bir oyuna evrilir:

- **ALT-KATMAN (Taktik Düello — çekirdek, DOKUNULMAZ):** FORGE-Core deterministik SIM üzerinde, temiz `Commander.js` zinciriyle sürülen, hilesiz AI'ın kuvvet-ekonomisiyle yetenekli insanı **1v1 gerçekten yendiği** taktik savaş. Bu düello, tek-yumruk "topak" yerine **ANA-ÇABA (Schwerpunkt) + SABİTLEME (Pin) + KANAT (Flank) + YEDEK (Reserve)** manevra-elementleriyle "gerçek askeri operasyon" oynar.
- **ÜST-KATMAN (Sefer Meta-Oyunu — çekirdeği SARAR):** Düello saf bir **fonksiyon** gibi çağrılır:
  ```
  düello(bütçe, düşman_garrison, seed) → { kazanan, hayatta_kalanlar }
  ```
  Bu kara-kutu, FTL / Into the Breach / Slay the Spire tarzı bir **düğüm-grafiği sefer** içine yerleşir: kalıcı komutan-ilerlemesi, veteran ordu taşıma, kaynak ekonomisi ve **kalıcılık gerilimi** ("pyrrhic zafer" cezalandırılır).

**Felsefenin META'ya kodlanması (nadir-iyi hizalama):** Komutan-XP = kuvvet-ekonomisi skoru. `Telemetry.js`'de zaten var olan `netValue = enemyValueDestroyed − lossAversion × aiValueLost` sinyali, "intihar-galibiyet az ödül, verimli-zafer çok ödül" mekaniğini **bedavaya** getirir. Oyunun ruhu (en az kayıpla en fazla hasar) doğrudan meta-ödüle işlenir.

### 1.2 Tür: "Taktik Roguelite + İnce Sefer Stratejisi"

**Konum:** Into the Breach × FTL × Wargroove arası.

**Gerekçe — neden TAM 4X / Total War DEĞİL:** Orijinal vizyon (dünya haritası, ülkeler, şehirler, kaynak zincirleri) cazip ama solo-dev + vanilla + hilesiz-AI gerçeğinde **tuzaktır**:

- AI'yı 30 cepheye böler → kuvvet-ekonomisi düellosu sulanır (çekirdek eğlence kaybolur).
- Devasa UI / ekonomi / pathfinding gerektirir → her sistem yarım kalır.
- Hilesiz-AI'ı çok-cephe yönetimine zorlamak, mevcut tek-otorite `Commander.js` mimarisini patlatır.

**Bunun yerine — aynı duyguyu 1/10 koda ulaştıran soyutlamalar:**

| Orijinal Vizyon | Roguelite Soyutlaması |
|---|---|
| Dünya haritası, coğrafya, pathfinding | 15–25 düğümlük **dallanan graf** (gerçek harita değil) |
| Ülkeler / fraksiyonlar | Düşman **arketipleri** (arşiv-genom kişilikleri) |
| Şehirler / kaynaklar | **Düğüm tipleri** (savaş / dinlenme / tedarik / olay / boss) |
| Komutan ilerlemesi | **Rütbe + perk + birim-kilidi** |
| Kalıcı imparatorluk | **Sefer-içi kalıcılık** (veteran carry-over, kalıcı kayıp) |

**Katmanlı melez yapı:**
- Çekirdek = roguelike-sefer (en az durum bilgisi).
- Üstü = cephe ilerleme çubuğu (görsel).
- Uzun-vade = opsiyonel Risk-vari bölge haritası (Faz E, **yalnız** çekirdek eğlenceliyse).

### 1.3 Eğlencenin Üç Direği

```
EĞLENCE = mikro-gerilim × makro-ilerleme × KALICILIK
          (kuvvet-ekonomisi   (kampanya yol-     (pyrrhic-zafer
           sınavı/düello)      seçimi/draft)       cezalandırılır)
```

Bu üçlü FTL/Slay-the-Spire'ın kanıtlanmış formülüdür. Eğlencenin **~%70'i zaten mevcut taktik katmanda** (counter-deploy, terrain, VP). Meta yalnızca "çerçeve" ekler — bu yüzden risk düşük, getiri yüksek.

---

## 2. DÜELLO FİNALİ: İNSAN-YENER AI DOKTRİNİ

> **Amaç:** Hilesiz AI, tek-kütle "topak" yerine ana-çaba + sabitleme + kanat + yedek ile **gerçek askeri operasyon** oynasın; arazi-farkında efektif-HP hesaplasın; mühimmat/reload penceresini ve sis-içi pusu olasılığını okusun; kendi siperini kursun.

### 2.1 Tasarım İlkesi: Mevcut Zincir KORUNUR, Aralarına Rol-Katmanı Girer

Mevcut akış değişmez:
```
gözlem (SİS-İÇİ, hilesiz) → cmdrDecide (makro plan) → cmdrOrderUnit (executor)
```
Araya **2 fonksiyonluk rol-katmanı** girer. Rol-atama **yalnız karar tickinde** (`decisionMs` histerezi içinde) yapılır → titreme yok, ucuz.

### 2.2 Foresight ↔ ROLE Otorite Sözleşmesi (KRİTİK — çelişen-emir önler)

**Sorun (kritikten):** `Foresight.js` (Schwerpunkt danışmanı) ile yeni `cmdrGroupTargets` ikisi de "nereye yığ" kararı verir → çakışma/titreme riski.

**Çözüm — tek otorite:**
- **Foresight = TEK Schwerpunkt otoritesi.** `cmdrGroupTargets.mainTgt = Foresight.schwerpunkt()` (yeni hesap DEĞİL — mevcut danışmanı çağır).
- **`cmdrAssignRoles` yalnız rol BÖLER**, "nereye-yığ" kararını Foresight'tan alır.
- Sonuç: çelişen-emir/titreme **imkânsız**. İki sistem tek zincire bağlanır.

### 2.3 Veri Modeli (`js/globals.js`)

```js
const ROLE = { MAIN: 0, PIN: 1, FLANK: 2, RESERVE: 3 };
```

`cmdrDecide` dönüşüne eklenir:
```js
plan.groups = { 0:{x,y}, 1:{x,y}, 2:{x,y}, 3:{x,y} };  // ROLE → hedef
plan.axis   = { ux, uy };   // saldırı ekseni (normalize)
plan.perp   = { px, py };   // dik eksen (kanat için)
```
Her birime `u.cmdrRole` (yalnız karar tickinde atanır).

### 2.4 YENİ FN1 — `cmdrAssignRoles(own, foes, fCx, fCy, oCx, oCy, plan, G)`

**İlk satır = over-engineer kalkanı (regresyon koruması):**
```js
if (plan.mode === 'RUSH' || plan.mode === 'REGROUP') {
  for (const u of own) u.cmdrRole = ROLE.MAIN;
  plan.groups[ROLE.MAIN] = { x: plan.x, y: plan.y };
  return;   // DOĞRULANMIŞ tek-kütle davranışı birebir korunur
}
```
**Bölme YALNIZ ATTACK / TERRITORY'de:**
```js
axis = normalize(fCx - oCx, fCy - oCy);
perp = { px: -axis.uy, py: axis.ux };

for (const u of own) {
  const isArty = u.range > artyRange || u.type === ARTILLERY;
  const isAT   = u.type === ANTI_TANK;
  const isFast = STATS[u.type].speed >= 0.85;
  if (isArty || isAT)                       u.cmdrRole = ROLE.PIN;
  else if (isFast && plan.mode === 'ATTACK') u.cmdrRole = ROLE.FLANK;
  else                                       u.cmdrRole = ROLE.MAIN;
}
```
**RESERVE ayrımı:** MAIN kütlesinden, `reserveShare × ownVal` değerine ulaşana dek **en yüksek hp/maxHp** birimleri RESERVE'e taşı (taze birimler yedek).

**FLANK koruma (parçalanma engeli):**
```js
if (flankForce < flankMinForce * ownVal) {
  // yetersiz kanat = boşalt, herkes MAIN
  for (const u of own) if (u.cmdrRole === ROLE.FLANK) u.cmdrRole = ROLE.MAIN;
}
```

### 2.5 YENİ FN2 — `cmdrGroupTargets(plan, foes, oCx, oCy, fCx, fCy, axis, perp, G)`

```js
plan.groups[ROLE.MAIN] = Foresight.schwerpunkt();          // TEK otorite (2.2)

plan.groups[ROLE.PIN]  = pointTowardFoe(pinStandoff);      // sabitleyici menzilini korur

// FLANK = düşman topağının dik-eksende ZAYIF yarısı:
let L = 0, R = 0;
for (const e of foes) {
  const s = (e.x - fCx) * perp.px + (e.y - fCy) * perp.py;
  if (s < 0) L += cmdrValue(e); else R += cmdrValue(e);
}
const sgn = (L < R) ? -1 : 1;
plan.groups[ROLE.FLANK] = {
  x: fCx + perp.px * sgn * flankDepth * nearR,
  y: fCy + perp.py * sgn * flankDepth * nearR
};

plan.groups[ROLE.RESERVE] = pointBehind(oCx, oCy, axis, 260);  // ekseni ters yönde geride
```

### 2.6 Executor — `cmdrOrderUnit` Cerrahi Değişiklik (tek satır + rol kasaları)

```js
const gt = plan.groups[u.cmdrRole] || plan.groups[ROLE.MAIN];
// plan.x / plan.y  →  gt.x / gt.y   (tek-satır değişiklik)
```
Rol ince-ayarları:

| Rol | Davranış |
|---|---|
| **MAIN** | Mevcut altın-açı halka (`spread`/`artySpread`) `gt` etrafında AYNEN |
| **PIN** | Mevcut topçu/AT standoff bloğu; merkez `gt = pinTgt` |
| **FLANK** | `attackTarget` = en yakın **kırılgan** düşman (`cmdrFragileRanged` → topçu/AT avı); `gt = flankTgt` hızlı yönelim; `foeThreat` ani artarsa geri çekil |
| **RESERVE** | `gt = reserveTgt`'ta **BEKLE**; yalnız 160px dibindeki düşmana saldır |

**DOKUNULMAZ:** Mevcut RECON-geride ve kendi-topçu özel kasaları aynen korunur.

### 2.7 Arazi-Farkında effHP Tehdit Modeli (EN KRİTİK İNSAN-YENER KAZANIM)

> **Kritikten gelen disiplin:** Bunu **önce TEK BAŞINA ship + ölç** (ROLE'den ayır). En yüksek getiri / en düşük risk değişiklik — tek fonksiyon, ROLE-bağımsız. 50 headless maçla "siper-killbox'a frontal koşmama"yı doğrula, **sonra** ROLE-katmanını ekle.

`cmdrValue` / `cmdrThreatValue` güncellemesi (`js/Commander.js:81,88`):
```js
const armorBonus = (u.inForest ? 3 : 0) + (u.inTrench ? 6 : 0);
const effHp = (u.hp / u.maxHp) * (1 + armorBonus / 8);
// hedef forest/trench'te ise SALDIRI-değerini × 1.4 (pahalı objektif = kaçın)
```
**Sonuç:** AI, siperdeki +9-armor piyadeyi "eşit" sanmaz, kill-box'a frontal koşmaz; kanat/topçu seçer. **Hilesiz:** yalnız `canSee` ile görülen düşman için okunur.

### 2.8 Kapanan 8 Exploit (her biri somut karşı-önlemle)

| # | EXPLOIT | KARŞI-ÖNLEM |
|---|---|---|
| 1 | **Siper-killbox körlüğü** | effHP tehdit modeli (forest +3, trench +6, saldırı ×1.4) → ucuz-ama-zırhlı savunmacıyı pahalı sayar |
| 2 | **AI hiç siper kurmuyor** (devasa asimetri) | **AI SİPER DOKTRİNİ:** nokta tutulunca/REGROUP'ta ENGINEER'ı noktanın düşman-tarafına 80–120px öne gönder, siper kur, topçu+AT+ARMOR_INF siperde konuşla → +6 armor simetrisi |
| 3 | **Topçu körlüğü** (tek RECON avlanınca) | En az **2 RECON ayrı sektörde** (biri Schwerpunkt, biri flank ekseni); görüş bitince topçu kör-ateş yerine standoff'a çekilip mühimmat ziyan etmez |
| 4 | **Reload-penceresi sömürüsü** | `cmdrOrderUnit` mühimmat/`lastAttackTime` okur: düşman boş-namlu penceresinde commit; kendi boş-namlu birimini standoff'a çek; `ammo < %15` → ENGINEER supply'a yolla |
| 5 | **Sis-içi AT pususu** | Foresight RUSH kararına bağlı: rota görülmeyen forest/sis'ten geçiyorsa "gizli AT/topçu" priorı (`foeThreat +%30`) → RUSH'ı **pin-and-probe**'a çevir (ucuz RECON yokla, ana kütle 1 tick bekle). Reaktif-iptal → proaktif-keşif |
| 6 | **Tek-yem-nokta + VP kaçırma** | Canlı `vpDelta`: geride isem `commitK` düşür (tempo zorla), önde isem yükselt; `cmdrBestPoint`'e tuzak-filtresi (sisli/forest çevreli aşırı-cazip nokta = killbox cezası) |
| 7 | **Zamanlama-pompası** (poke→çekil mod-salınımı) | **Asimetrik histerezi:** ATTACK→REGROUP kolay; REGROUP→ATTACK için `foeThreat > commitK×1.15` **VE** 2 ardışık tick stabil. Telemetri: `modSwitchCount/10sn > 3` ise histerezi sıkılaştır |
| 8 | **Mid-battle adaptasyon yok** (paradrop = counter'ın counter'ı) | RESERVE + VP-farkındalığı **kısmi** telafi; tam çözüm meta-katman counter-deploy zenginleşmesi (dürüst kabul) |

### 2.9 Yeni Genler + Limitler + Kişilik Override

| Gen | Varsayılan | Limit |
|---|---|---|
| `reserveShare` | 0.15 | [0, 0.35] |
| `flankDepth` | 0.80 | [0.4, 1.2] |
| `flankMinForce` | 0.20 | [0, 0.5] |
| `pinStandoff` | 0.88 | [0.6, 0.95] |
| `commitReserveK` | 0.35 | [0.2, 0.6] |

**Kişilik override'ları:**
- **TURTLE:** `flankDepth: 1.1`, `reserveShare: 0.25`
- **AGGRO:** `flankMinForce: 0.10`, `reserveShare: 0.05`

Self-play'de evrilir.

### 2.10 RESERVE Devreye-Girme Tetiği

```js
// ATTACK'a girişte MAIN değerini kaydet:
COMMANDER.mainRefVal = mainValue;
// Tetik: MAIN < mainRefVal*(1 - commitReserveK)  VEYA  FLANK temas
//        → bir sonraki tick reserveShare = 0 (yedek dökülür)
```

---

## 3. EĞİTİM PLANI (İNSAN-YENER BEYİN)

> **Kök sorun (denetimden):** İki ayrı eğitim sistemi birbirini bilmiyor. (1) `js/SelfPlay.js` `spStartTraining` gerçek-motorda ama **tek-şampiyon elitizm** → stratejik unutma / taş-kağıt-makas döngüsü. (2) `js/AI.js:1948+` AlphaStar-vari tam lig AMA soyut `simulateSpatialMetaMatch`'e bağlı (gerçek fizik değil).

### 3.1 GENOM-UZAYI ÇATLAĞINI ÖNCE KÖPRÜLE (Faz B'den önce — en sinsi risk)

**Sorun (kritikten):** Lig mantığı `AI.js`'de `TacticalAI` genom-uzayında (`TACTIC_GENE_LIMITS`). Canlı düelloyu `Commander.js` **ayrı** 16-gen uzayında sürüyor. "Lig'i gerçek-motora taşı" demek aslında aile-arşivi + hibrit-üretim + `hallOfFame`'i Commander'ın gen-vektörüne **yeniden yazmak** = haftalar.

**Çözüm — genom-AGNOSTİK lig sarmalı:**
- Lig altyapısını (`insertHallOfFame` dedup, `mainPool`/`exploiter`, PFSP) **opaque genome-objesi** + mevcut `spRunMatch(redG, blueG)` (`SelfPlay.js:136`) üstüne kur.
- `AI.js`'in `simulateSpatialMetaMatch`'ine **HİÇ dokunma**; onu tamamen bırak (ölü-kod, silme = regresyon riski).
- Lig yalnız `Commander.js`'in 16-gen vektörüyle çalışsın.
- Böylece "taşıma" değil "spRunMatch etrafına ince-lig-sarmalı" = **günler, haftalar değil.**

### 3.2 Altı Katman (kaldıraç sırasıyla)

#### KATMAN 1 — Gerçek-Motorlu Past-Players Ligi (en yüksek kaldıraç)
```js
const SP_LEAGUE = { mainPool: [], exploiters: [], maxPool: 8 };
```
`spBuildOpponents`'i **PFSP**'ye çevir — aday rakip dağılımı:
- %40 mirror
- %30 mainPool'dan geçmiş şampiyon (yenemediğine `(1 − winRate)²` ağırlık)
- %15 turtle/aggro
- %15 kazanan-insan replay

Nesil sonu yeni champion mainPool'a **eklenir** (signature dedup = `JSON.stringify(brain)`). `maxPool` aşılınca **en eski değil**, "herkesin kolay yendiği"ni at (çeşitlilik korunur). → tek-şampiyon döngüsü kırılır.

#### KATMAN 2 — Exploiter Ajan (anti-cycling)
Her 5 nesilde bir, **yalnız güncel champion'a** karşı eğitilen saf-saldırgan aday (mirror/geçmiş/replay yok). `> %65` kazanırsa o genomu sonraki nesil havuzuna **zorla** ekle → main onu yenmeyi öğrenir. AlphaStar'ın sağlamlık motoru.

#### KATMAN 3 — İmitasyon Tohumu (insan-gibilik garantisi)
`spImitationSeed(replays)`: `r.playerWon === true` kazanan-insan replay'lerinden parametrik davranışsal-klonlama (MLP'siz):

| İnsan İstatistiği | → Gen |
|---|---|
| ortalama temas-zamanı | `decisionMs`, `commitK` |
| emir-mesafesi | `vanguardAggression` |
| komut-anı birim-yoğunluğu | `cohesion`, `spread` |
| ordu kompozisyonu | `counterMatrix` eğilimi |

Eğitime **bu tohumla** başla (DEFAULT yerine). Kazanan-insan replay `fitHuman` ağırlığı **2×** (kazananı yenmek asıl hedef).

#### KATMAN 4 — Curriculum Kapıları (kolay → zor)
| Faz | İlerleme | Rakipler | KAPI |
|---|---|---|---|
| A | 0–%25 | random-mirror + zayıf-aggro | win-rate ≥ %70 |
| B | %25–60 | + all-arty + turtle | turtle'a VP-farkı > 0 |
| C | %60–100 | + past-players havuzu + kazanan-insan replay | — |

Mevcut `genReplayWins`/`genMatches` takibini kullanır. Öğrenmeyi 2–3× hızlandırır, gürültülü fitness'ı temizler.

#### KATMAN 5 — Temsil: ÖNCE Gen-Limiti Genişlet, MLP'yi ERTELE
`brain.js`'de doygunluk kanıtı var (`vanguardRetreat=0.48=max`, `threatAvoidance=1.6=max`, `cohesion≈max`).
1. Doygun genleri `%30` genişlet, yeniden eğit.
2. **2 ucuz durum-geni** (MLP'siz): `phaseAggressionDelta` (erken/geç-oyun) + `losingAggressionDelta` (geride kalınca tutum) → stateless politikanın durum-körlüğünü ucuza çözer.
3. **Bunlar da doyunca** küçük MLP: 12-girdi (own/foe değer-oranı, vpDelta, topçu-payı, mesafe, faz) → mod-seçici (ATTACK/RUSH/REGROUP/TERRITORY olasılık) + spread/standoff skaler. 2 katman × 16 nöron ≈ 500 ağırlık, saf-JS forward, **gradyan YOK** (aynı genetik evrim). Komutan mod-tabanlı olduğu için MLP "mod seçici" olarak temiz takılır.

#### KATMAN 6 — Ödül Rafinesi + Hız
`spMatchFitness`'e **küçük** (ana sinyalin %10–15'i) doktrin terimleri:
- Yoğunlaşma ödülü (kazanılan temasta yerel Lanchester N² üstünlüğü → Schwerpunkt)
- Kanat ödülü (`facingAngle` ile yan/arka vuruş)
- Anti-blöf cezası (pusuya geç tepki + büyük kayıp)

Ağırlık küçük tut (Goodhart önle). **HIZ:** `spRunMatch`'i Blob-Worker'da koş (stepSim+units+STATS Worker'a), 2–4 Worker paralel maç, ana thread üreme/seçim. NODE değil tarayıcı Worker'ı. Determinizm (`spGoldenTest`) Worker'da da geçmeli (her maça seed geç). 20.000 maç saatler → dakikalar.

### 3.3 Kapalı-Döngü Validasyon (15-maç DEĞİL — kritikten)

- **Hold-out kazanan-insan replay seti** (eğitime sokma) + `spRunMatch` ile AI'yı o replay'lere karşı headless oynat → win-rate ölç.
- **50–100 headless maç** (snapshotSIM bedava) >> 15 elle-maç.
- Zamanlama-pompası için somut sayaç: `COMMANDER.modSwitchCount/10sn`; `> 3` ise asimetrik-histerezi'yi sıkılaştır.
- `SP_LEAGUE`'de basit **Elo** → "gerçekten ilerliyor mu yoksa döngüde mi" görünür.

### 3.4 İnsan-Gibilik Koruması (tüm katmanlarda)
- Yapı sabit (sektör-makro, histerezi, `COMMANDER_DECISION_JITTER`, 3 kişilik).
- Süper-APM yok (plan seyrek, her tick mikro-yönetim yok).
- Tohum insandan (Katman 3).
- **Yalnız sayılar/ağırlıklar evrilir** → robotik değil, insan-tempolu.

---

## 4. GENEL YAPI: DÜNYA / EKONOMİ / ÇEKİRDEK DÖNGÜ

### 4.1 Dünya / Kampanya

**Düğüm-grafiği** (gerçek coğrafya/pathfinding DEĞİL — solo-dev doğru soyutlama).

- Tek tohumdan deterministik üret: `generateCampaignMap(seed)` (mevcut `mulberry32`).
- localStorage'a **sadece** `{seed, day, owned-ids, commander, warfunds, reserveArmy}` (~2KB, tüm harita değil).
- Bölge düello tohumu = `campaign.seed ^ region.id` → her bölge **sabit haritada** savaşılır ("reload edip kolay harita al" istismarı kapanır).

**Düğüm tipleri:**

| Simge | Tip | İşlev |
|---|---|---|
| ⚔️ | SAVAŞ | Standart düello |
| 🛡️ | ELİT-SAVAŞ | Yüksek garrison, büyük ödül |
| 🏥 | DİNLENME | Veteran onar |
| 💰 | TEDARİK | Birim al |
| ⭐ | OLAY | Seçim (Slay-the-Spire dallanma) |
| 👑 | BOSS | Sefer-sonu, en-iyi-şampiyon genom |

**Bölge nitelikleri:**
- **biome** (ova/dağ/orman/şehir → mevcut terrain üreticisine 1 parametre; dağ = savunma-avantajı, şehir = yüksek-VP + garrison).
- **faction** (oyuncu-başkenti + 2–3 düşman + tarafsız).
- **garrison** (`aiDeploy`'a `counts` olarak verilir).
- **reward** (warfunds + bazıları birim-kilidi/perk).

**Kampanya bağlama:**
- Kazanma = tüm düşman başkentlerini fethet **VEYA** doğrusal son-düğüm = düşman-ana-komutanı (boss düello, en-yüksek garrison + özel genom).
- **Kalıcılık — iki localStorage anahtarı:**
  - `pixelRtsCampaign` (sefer-state, kaybedilince sıfırlanır)
  - `pixelRtsCommander` (KALICI komutan, sefer-üstü)
- Mevcut `GENOME_KEY`/`MEMORY_KEY`'e **DOKUNMA** (AI-öğrenmesi ile oyuncu-ilerlemesi temiz ayrışır).
- **Düşman hamlesi Faz E'ye ertelenir** ama hook şimdiden konur: `spreadFactions(day)` (her N günde en-agresif fraksiyon komşu tarafsız bölgeye yayılır → turtle-kırıcı dünya-baskısı).

### 4.2 Ekonomi & İlerleme

**ÜÇ-KAYNAK (sade):**

| Kaynak | Simge | Rol |
|---|---|---|
| Para | ₿ | deploy bütçesi (mevcut `money`) |
| İnsan-gücü | 👥 | birim-SAYISI tavanı (para olsa bile bitince ordu kuramazsın — kuvvet-ekonomisini META'da MEKANİK zorlar) |
| Sanayi | ⚙ | tech/upgrade hızı |

**Bütçe köprüsü (tek dokunuş — `globals.js:355`):**
```js
// player.money = 1500  →
battleBudget = BASE(1500) + cityIncome*mult + commanderRankBonus(rütbe×120)
             + doctrineBonus - manpowerPenalty;
manpowerCap  = baseManpower + capturedTerritories*2;
// enemy.money de meta'dan. Geri-uyum: meta yoksa 1500'e düşer.
```

**İlerleme eğrisi (somut):**
| Aşama | Bütçe | Manpower | Rütbe |
|---|---|---|---|
| Sefer-başı | 1500 ₿ | 12 | 1 |
| 3-zafer | 2100 ₿ | 16 | 2–3 (+1–2 tech) |
| Orta | 2800 ₿ | 22 | 4 (+elit birim) |
| Final (başkent) | 3500 ₿ | — | düşman da güçlü |

**Zorluk hilesiz ölçeklenir (felsefe koruması):**
```js
enemyBudget = playerArmyValue * (0.95 + 0.04*tur);  // hep ~başabaş, hafif önde
```
Mevcut counter-deploy (`aiDeploy`) artan bütçeyle daha zengin counter-ordular kurar → zorluk **asla** görüş/para-hilesiyle değil, organik.

**Tech ağacı (3 dal × 4 kademe = 12, genome'a DOKUNMA):**
`UNIT_TYPES`'a paralel `techMods` çarpan-tablosu (örn `{ARMOR:{hp:1.15}}`); birim = baz × techMods.
- **ZIRH dalı:** tank+hp → menzil → AT-direnci → AĞIR-TANK (10. tip)
- **PİYADE dalı:** atış-hızı → panik-direnci → MECH-hız → ŞOK-BİRLİĞİ
- **DESTEK dalı:** splash → görüş → medic → ROKETATAR

Sefer-içi 4–6 tech → roguelike build çeşitliliği.

**Komutan-XP = adjudication kuvvet-ekonomisi skoru:**
```js
xp = düşmanZayiatı*1.0 - kendiZayiat*1.5 + vpMargin*0.5;
// (mevcut Telemetry.js reward / enemyValueDestroyed - aiValueLost'tan)
```
İntihar-galibiyet az XP, verimli-zafer çok XP.

**6 Rütbe, her biri 1 yetenek-slotu (max-3 aktif, deploy-öncesi pasif):**
| Perk | Etki |
|---|---|
| Schwerpunkt | ana-çaba +%10 (Vizyon B'ye bağlanır) |
| Lojistikçi | +200 bütçe |
| Çelik-Duvar | +1 zırh |
| Hızlı-Seferberlik | +3 manpower |
| Pusucu | ilk-temas flank +%15 (Commander pusu-mantığı) |
| Kanaat-Önderi | panik-direnci +%25 |

Perkler **STATS KLONU** üzerinde çarpan (orijinal bozulmaz, düello determinizmi korunur).

### 4.3 Çekirdek Oturum Döngüsü

```
[ANA MENÜ: Yeni-Sefer / Devam / Hızlı-Düello (mevcut mod KORUNUR = geri-uyum + risk-izolasyonu)]
   │
   ▼
[1) SEFER HARİTASI: düğüm-grafiği, oyuncu SONRAKİ düğümü SEÇER = yol-kararı = strateji]
   │
   ▼
[2) BRİFİNG / MODIFIER: düşman önizleme (arketip + tahmini-değer + doktrin-ipucu), biome, ödül-önizleme]
   │
   ▼
[3) DEPLOY: MEVCUT sistem. FARK = bütçe sefer-kasasından + roster sadece-açılmış-birimler
            + veteranlar BEDAVA-buff'lı önceden-konuşlu + "Önceki Kuruluşu Tekrarla" butonu]
   │
   ▼
[4) DÜELLO: MEVCUT ÇEKİRDEK stepSim/Commander/VP DOKUNULMAZ; hilesiz-AI = arşiv-genom + arketip]
   │
   ▼
[5) SONUÇ / ÖDÜL: telemetry.reward → komutan-XP; sağ-kalanlar → veteran (seferde taşınır);
                  ölenler → KALICI-kayıp; düğüm-ödülü = 3-karttan-1-seç (draft)]
   │
   ├── KAZAN → haritaya geri
   └── KAYBET → sefer-bitti (meta-ödül KALIR: komutan-seviyesi + açılan-birimler + sefer-skoru)
                → ANA MENÜ
```

**Kazanma 3-katman:** maç-içi (imha/`VP_TARGET 3000`) / sefer-içi (boss-düğümü) / meta (tüm-kıtalar VEYA yüksek-sefer-skoru = tekrar-oyna).

**Tekrar-oynanabilirlik = 3-çarpan** (var-olanı meta'dan çağır, yeni-içerik yazma):
```
rastgele harita-grafiği × düğüm-modifier × düşman arketip-doktrin
                          (yoğun-sis vision×0.6 /  (turtle/aggro/all-arty
                           dağ-ağır / topçu-yasak    ZATEN SelfPlay'de var)
                           roster-kısıt / gece)
```

**Gerilim = KALICILIK:** "pyrrhic zafer" (kazandın-ama-ordun-bitti) cezalandırılır → oyuncu kuvvet-ekonomisini oynamaya **mecbur**.

**FORGE-Core kaldıracı:** `snapshotSIM` headless rollout → **AUTO-RESOLVE bedava** (oyuncunun-pas-geçtiği/düşman-düşman çatışmaları gerçek-fizikle arka-planda `spRunMatch`, <1sn → "yaşayan dünya" ayrı soyut-savaş-modeli YAZMADAN).

---

## 5. MVP META-OYUN (3-DÜĞÜM DİKEY DİLİM)

> **Amaç:** Sefer döngüsünün (savaş → ödül → bütçe-büyür → sonraki-savaş) **EĞLENCELİ olup olmadığını** minimum kodla doğrula. Solo-dev #1 riski = yanlış-şeye-ay-harcamak; bu dilim onu önler.

### 5.1 Kapsam

- **3 düğüm:** 1 başlangıç-owned + 1 cephe-savaş + 1 düşman-başkenti/boss.
- **HARİTASIZ** (Canvas overworld'e GİRME) — sadece DOM butonlu lineer liste + sayaç "Düello 2/3" (mevcut deploy-ekran stiliyle).

### 5.2 Sistemler (yalnız bunlar)

1. Tek-kaynak `warfunds` (artan garrison-bütçesi 1500 → 1800 → 2400).
2. Tek-ilerleme-ekseni: komutan rank + perk (xp = kuvvet-ekonomisi; 1–2 perk: +bütçe / veteran-buff).
3. Veteran carry-over (sağ-kalanlar bedava taşınır, ölenler kalıcı-kayıp).
4. Tek-SAVE objesi (`localStorage pixelRtsCampaign`).
5. **Hızlı-Düello modu KORUNUR** (risk-izolasyonu).

### 5.3 Çekirdeğe 3 Dokunuş (DOĞRULANDI — minimal)

```js
// (a) globals.js:355  — geri-uyumlu bütçe köprüsü
player.money = (campaign?.deployBudget) ?? 1500;
enemy.money  = (campaign?.enemyBudget)  ?? 1500;

// (b) startBattle  — bölge-deterministik seed
resetSimRng(campaign.seed ^ region.id);

// (c) checkGameOver sonu  — sefer callback'i
if (campaign.active)
  onCampaignBattleEnd(won, units.filter(u => !u.isRed && !u.dead));
```

### 5.4 Yeni Dosyalar
- `js/Campaign.js` (~400–600 satır): state-machine + SAVE.
- `js/CampaignUI.js`: liste-menü + ödül-ekran.

### 5.5 Sahne Geçişi — TAM REFACTOR YAPMA
`restart-btn` (`location.reload()` → **ölümcül**, state uçar) yerine hafif:
```js
showScreen('map' | 'deploy' | 'battle' | 'over');
resetBattleState();
```

### 5.6 KRİTİK: `resetBattleState` State-Envanteri (hayalet-bug önleme)

> **En pahalı bug-türü:** Bir-tek-unutulan global → sefer-2'ye sızan hayalet-state → deterministik-olmayan bug, NODE/test-YOK ortamda avlanması cehennem.

**Campaign.js'den ÖNCE**, TÜM mutable-global'i tek-yere listele ve `resetBattleState`'i o listeden **türet**:
```js
// MUTABLE GLOBAL ENVANTERİ (proaktif):
units, trenches, SIM, COMMANDER, supportCooldowns,
gameTime, fog, player, enemy, battleTelemetry
// + her sefer-geçişinde sağlık-kontrolü:
console.assert(units.length === 0 && trenches.length === 0,
               'resetBattleState sızıntı!');
```

### 5.7 MVP'ye Şimdi Konacak 2 Anti-Sahte-Karar Önlemi (kritikten)

> **Risk:** Modifier'sız 3-düğüm dilim = "aynı maçı 3 kez oyna" → döngünün-eğlenceli-mi sorusunu **yanlış** test eder (false-negatif).

1. **3 MODIFIER ŞİMDİ koy** (haritasız ama çeşitli): düğüm-2 = "yoğun-sis `vision×0.6`", düğüm-3 = "dağ-ağır biome". Mevcut terrain/fog/STATS'a tek-çarpan. → "döngü-eğlenceli-mi" testi GERÇEK çeşitlilikle yapılır.
2. **HIZLI-DEPLOY tek-tık-tekrar** (~30 satır): "Önceki Kuruluşu Tekrarla" butonu — son-kompozisyonu (SAVE'de zaten var) bütçe-yetiyorsa otomatik yerleştir, oyuncu sadece delta-düzenler. FTL-temposunu korur, sefer sürünmekten kurtulur.

### 5.8 MVP Net Hedef: Sefer-Skoru
Meta-kazanma muğlak olmasın. **Tek-net hedef:** kümülatif komutan-XP (= Σ kuvvet-ekonomisi skoru). Tek-sayı → tekrar-oynanabilirlik + "verimli-oyna" baskısı + leaderboard-hazır, sıfır-ekstra-sistem.

---

## 6. FAZLI YOL HARİTASI

> Her faz **SONUNDA oynanabilir/kayıtlı** olmalı (yarım-meta = oynanamaz oyun).

### FAZ A — DÜELLO FİNALİ (insan-yener cila; META'YA GEÇME)
**Hedef:** Hilesiz AI yetenekli insanı 1v1 GERÇEKTEN yensin; manevra-elementleri devrede.

Kritik sırayla:
1. **effHP tehdit modeli TEK BAŞINA** (`cmdrValue`/`cmdrThreatValue`) → 50 headless maçla doğrula (risk-izole).
2. ROLE enum + `plan.groups` rol-katmanı (`cmdrAssignRoles` + `cmdrGroupTargets`, RUSH/REGROUP'ta boşalt, Foresight=Schwerpunkt otoritesi).
3. flankSide zayıf-kanat + FLANK kırılgan-av.
4. 5 yeni gen + limit + TURTLE/AGGRO override.
5. AI siper doktrini (ENGINEER yönlendirme).
6. RESERVE-tetik + asimetrik histerezi.
7. Mühimmat/reload mikro + çoklu-RECON + Foresight RUSH-priorı.

**Doğrulama:** 50–100 headless + 10–15 canlı maç, rol-telemetrisi (`flankKills`, `reserveCommitted`, `modSwitchCount`).
**Tahmin:** 1–2 hafta (GERÇEKÇİ — Commander.js cerrahi, küçük).

### FAZ B — EĞİTİM YÜKSELTME (insan-yener beyin)
**Hedef:** Tek-şampiyon → past-players ligi; insandan-tohum; curriculum.
1. **Genom-uzayı çatlağını köprüle** (3.1) — lig genom-agnostik, `spRunMatch` sarmalı, `AI.js` ölü-kod.
2. SP_LEAGUE.mainPool + PFSP.
3. Exploiter ajan (5-nesilde-bir, >%65 → havuza-zorla).
4. `spImitationSeed` (kazanan-insan replay → parametrik tohum, fitHuman 2×).
5. Curriculum kapıları (FazA/B/C win-rate eşikleri).
6. ÖNCE gen-limit %30 genişlet + 2 durum-geni; MLP'yi ERTELE.
7. Küçük doktrin-ödül terimleri.

**Validasyon:** hold-out replay seti + Elo (3.3).
**Tahmin:** 1–2 hafta (köprüleme sayesinde; aksi halde haftalar). Worker'ı C'ye ertele.

### FAZ C — MVP META (3-düğüm dikey dilim)
**Hedef:** Uçtan-uca sefer döngüsü oynanabilir + kayıtlı.
- `js/Campaign.js` + `CampaignUI.js`.
- 3 çekirdek-dokunuş (bütçe-köprüsü / bölge-seed / onDuelEnd-callback).
- `resetBattleState` state-envanteri ÖNCE (5.6).
- 3 modifier + hızlı-deploy (5.7).
- warfunds + komutan-rank/perk + veteran-carry-over + tek-SAVE.
- Hızlı-Düello korunur.

**Tahmin:** 2–3 hafta (sahne-yöneticisi yüzünden 3–4'e kayabilir).
**SONUNDA:** "döngü eğlenceli mi?" kararı.

### FAZ D — META DERİNLİK (overworld + ekonomi)
**Hedef:** FTL-tarzı grafiği + üç-kaynak + tech + arketip-eşleştirme.
- Canvas overworld (mevcut camera/minimap render yeniden-kullan).
- 9–12 bölge + biome → terrain bağlama.
- Üç-kaynak (insan-gücü tavanı + sanayi).
- `techMods` çarpan-tablosu (12-düğüm, genome'a dokunma).
- Düğüm-modifier (sis/dağ/topçu-yasak/gece).
- `hallOfFame` arşiv-genom arketip-eşleştirme (erken-zayıf → boss-en-iyi).
- 3-karttan-1 ödül-draft.
- AUTO-RESOLVE (snapshotSIM headless).
- Worker'a geç (gece-eğitimi).

**Tahmin:** 2–4 hafta. **YALNIZ Faz C eğlenceliyse.**

### FAZ E — RİSK-VARİ DÜNYA (opsiyonel)
**Hedef:** Yaşayan-dünya + çoklu-başkent + dünya-hakimiyeti.
- `spreadFactions(day)` (en-agresif fraksiyon komşu-tarafsıza yayılır = turtle-kırıcı baskı).
- Çoklu düşman-başkenti.
- Dünya-hakimiyeti kazanma.
- NewGame+ (şampiyon-havuzu yükselir).

**Tahmin:** 2–4 hafta. **SADECE Faz C-D eğlenceliyse** — tam-Risk AI-vs-AI bölge-simülasyonu + diplomasi solo-dev TUZAĞI.

---

## 7. FİZİBİLİTE, RİSKLER & KAPSAM DİSİPLİNİ

### 7.1 Fizibilite Kanıtı (koddan doğrulandı)

Mevcut motor meta için **şaşırtıcı hazır**:
- `startBattle` bütçeyle deploy ediyor (`player.money` `globals.js:355`).
- `spDeployArmy(counts)` düşmanı verilen-kompozisyonla kuruyor.
- `checkGameOver` `won = true/false/'draw'` döndürüyor (`main.js:291,298,301`) → savaş temiz "gir-oyna-çık" KARA KUTU.
- `snapshotSIM`/`spRunMatch` headless (`SelfPlay.js:109,136`) → AUTO-RESOLVE bedava.
- Persistans hazır (localStorage pattern).
- **Felsefi hiza mükemmel:** komutan-XP'yi kuvvet-ekonomisine bağlamak (Telemetry.js:36 `netValue` ZATEN var) oyunun ruhunu meta-ödüle çevirir.

### 7.2 En Büyük Riskler (öncelik sırasıyla)

| # | RİSK | DURUM / AZALTMA |
|---|---|---|
| 1 | **Genom-uzayı çatlağı** (en sinsi) | Lig `AI.js` `TACTIC_GENE_LIMITS`'te, düello `Commander.js` 16-gen'de. "Taşıma" = yeniden-yazma = haftalar. **AZALTMA:** genom-agnostik lig sarmalı (3.1) — `spRunMatch` üstüne, `AI.js`'e dokunma |
| 2 | **Sahne-yöneticisi borcu + state-sızıntısı** | `location.reload()` (`main.js:259`) yerine `resetBattleState` gerek; bir-unutulan global = hayalet-bug. **AZALTMA:** state-envanteri + `console.assert` (5.6) |
| 3 | **AI-insan-yener henüz KANITLANMADI** | effHP/flank/siper KODDA YOK (sadece `cmdrFragileRanged` var). 8 exploit-kapanış PLAN, validasyon değil. **AZALTMA:** 50–100 headless + hold-out replay (15 elle-maç yetmez, insan adaptif) |
| 4 | **Düğüm-seçimi sahte-karara düşer** | Her düğüm "başka düello" + zayıf modifier → "max-ödül"e optimize → yol-seçimi çöker. **AZALTMA:** modifier'ları MVP'de ERKEN koy (5.7) |
| 5 | **Özellik-şişmesi Faz D-E'de** | Faz D tek başına 5 büyük-sistem; "Faz C eğlenceliyse" kapısı sunk-cost'la kolay aşılır. **AZALTMA:** KESİN-YAPMA listesi (7.3), faz-kapıları sert |
| 6 | **Deploy-tekrarı tempoyu öldürür** | 15–25 düğüm × manuel deploy = FTL temposu boğulur. **AZALTMA:** hızlı-deploy tek-tık-tekrar (5.7) |

### 7.3 Kapsam Disiplini — KESİN YAPMA (özellik-şişmesi = #1 ölüm-riski)

- ❌ Gerçek-gezilebilir-harita + birim-hareketi + ikmal-hatları + pathfinding (soyut graf 5-düğüm yeter).
- ❌ Tam-tech-tree + bina-inşa + kaynak-madenciliği-zinciri (tek-kaynak + perk yeter, sonra üç-kaynak).
- ❌ Diplomasi + çok-fraksiyon-ittifak + ticaret (Faz E+).
- ❌ Prosedürel-sonsuz-dünya (elle-tasarlı 5-bölge daha-iyi-tunelenir).
- ❌ Sahne-yöneticisini-geç-yazıp global-namespace-refactor'a kalkma.

**Her yeni meta-sistem için sor:** "Bu DÜELLOYU daha-iyi-mi yapıyor yoksa dikkat-mi-dağıtıyor?"

### 7.4 Tahmin Gerçekçiliği

| Faz | İyimser | Gerçekçi |
|---|---|---|
| A (düello-cila) | 1–2 hafta | 1–2 hafta ✓ |
| B (eğitim) | 1–2 hafta | 1–2 hafta (köprüleme ŞART) |
| C (MVP-meta) | 2–3 hafta | 3–4 hafta (sahne-yöneticisi) |
| D (derinlik) | 2–4 hafta | 2–4 hafta |
| E (Risk-opsiyonel) | 2–4 hafta | 2–4 hafta |
| **OYNANABİLİR-META** | ~6–9 hafta | **9–13 hafta** |

**UYARI:** Paralel-sistem eklenirse 2–3× şişer. Tek-özelliğe-odaklan.

### 7.5 Yapısal Borç Notu
- Tek-dosya (`pixel-rts-tek-dosya.html`, 449KB) vs `js/` ikiliği; `split.js` birleştiriyor. `Campaign.js`+`CampaignUI.js` build-disiplinini zorlar; NODE/test-YOK → her birleştirme MANUEL doğrulama = her commit'te regresyon-riski.
- ~9300 satır tek-global-namespace; `phase` sadece DEPLOY/BATTLE/OVER (`globals.js:351`).

---

## 8. KULLANICIYA AÇIK SORULAR

Bu kararlar tasarımın gidişatını kökten değiştirir — netleştir:

1. **Sıralama:** Düello-cila (Faz A) + eğitim (Faz B) GERÇEKTEN bitmeden meta'ya (Faz C) geçmek mi, yoksa "tek düello zaten yeterince iyi, hemen meta" mı? (Tüm fizibilite Faz A/B önce-bitsin varsayıyor.)

2. **İnsan-gibilik vs salt-güç:** AI insanı yensin ama "insan-tempolu/blöfe-açık" mı kalsın (histerezi + kişilik + seyrek-plan korunur), yoksa "mümkün-olan-en-güçlü" (süper-tepki, sürekli-mikro) mü? Bu, eğitim-ödülünü ve MLP kararını belirler.

3. **MVP meta türü onayı:** "Taktik Roguelite" (FTL-tarzı düğüm-sefer, kalıcı-kayıp, komutan-progression) mu, yoksa orijinal "kalıcı-imparatorluk/dünya-fethi" (Risk-vari, geri-alınabilir bölgeler) mı? İkisi çok farklı kod-yolu.

4. **Carry-over/kalıcılık sertliği:** Yenilgide veteran-ordu SIFIRLANSIN mı (roguelike-risk, gerilim-yüksek) yoksa kısmi-korunsun mu (daha-affedici)? Eğlence-tonunu kökten değiştirir.

5. **MLP'ye geçiş:** Önce gen-limitlerini genişletip durum-genleri eklemek (MLP'siz, ucuz) yeterli mi, yoksa baştan küçük-MLP (mod-seçici) mi? (Öneri: önce gen-limiti, MLP'yi ertele.)

6. **Web Worker:** Gece-eğitimi (20k maç) senin için kritik mi? Evetse Worker'a-geçiş erken öncelik kazanır; değilse tek-thread `requestAnimationFrame` yeterli.

---

> **Özet karar:** Önce **effHP'yi tek başına** ship + 50-headless-maçla ölç (en yüksek getiri / en düşük risk). Sonra ROLE-katmanı + Foresight-otorite-sözleşmesi. Faz B'de **genom-uzayı çatlağını köprüle** (lig sarmalı, AI.js'e dokunma). Faz C MVP'de **modifier + hızlı-deploy + state-envanteri** olmazsa olmaz. Her faz sonunda oynanabilir kal; "Bu düelloyu daha iyi mi yapıyor?" sorusunu her sistemde sor.
