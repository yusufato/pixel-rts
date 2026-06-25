# PIXEL EUROPA — Açık Dünya Tasarım Belgesi

> **Tek cümlelik özet:** Mevcut **FORGE-Core taktik düellosunu** (deterministik, hilesiz TEMİZ KOMUTAN, 9 birim, bölge-puanı, sis-savaşı) **ALT-KATMAN** olarak saklayan; üstüne **büyük pixel-Avrupa haritası + RPG-devletler + yaşayan dünya-AI + 4-çağ Hikaye + Hızlı Maç** ekleyen iki-katmanlı bir açık-dünya.

**Durum:** Tasarım sabit, uygulama Faz-0'dan başlamadı.
**Hedef ortam:** Saf vanilla JS + Canvas, tek tarayıcı sekmesi. **NODE/build/test/GPU YOK.** ~9500 satır mevcut kod.
**Konum:** `/home/osman/Masaüstü/RTS strateji oyunu/`

---

## İçindekiler

1. [Vizyon](#1-vizyon)
2. [Görsel: Pixel-Avrupa Haritası](#2-görsel-pixel-avrupa-haritası)
3. [RPG-Devlet Sistemi](#3-rpg-devlet-sistemi)
4. [Dünya-AI](#4-dünya-ai)
5. [Ana Ekran & UI Akışı](#5-ana-ekran--ui-akışı)
6. [Hızlı Maç](#6-hızlı-maç)
7. [Hikaye Modu + 4 Çağ](#7-hikaye-modu--4-çağ)
8. [Ekonomi & İlerleme & Kalıcılık & Save](#8-ekonomi--i̇lerleme--kalıcılık--save)
9. [MVP](#9-mvp)
10. [Fazlı Yol Haritası](#10-fazlı-yol-haritası)
11. [Fizibilite & Tuzaklar & Çağ-Stratejisi](#11-fizibilite--tuzaklar--çağ-stratejisi)
12. [Kullanıcıya Açık Sorular](#12-kullanıcıya-açık-sorular)

---

## 1. Vizyon

### 1.1 Çekirdek Prensip — "4 Değer Enjeksiyonu"

Oyun **iki katmandan** oluşur ve aralarındaki bağ **tek bir saf fonksiyonla** kilitlenir:

```
ÜST-KATMAN (Meta: harita, devletler, dünya-AI, ekonomi)
        │
        │  stateToBattleConfig(state, contestedProvince)
        │  ──> SADECE 4 DEĞER: { bütçe, kişilik, gen-override, veteranlar }
        ▼
ALT-KATMAN (Düello: FORGE-Core, komutan, 9 birim, bölge-puanı)
        │
        │  checkGameOver() ──> { win | loss | draw }
        ▼
ÜST-KATMAN applyBattleOutcome(won) ile sonucu sindirir
```

**Düello, üst-katmandan başka HİÇBİR meta-state görmez.** Bu, tasarımın en sağlam ve en korunması gereken fikridir. Düellonun deterministikliği ve "kara kutu" temizliği bu sayede bozulmaz.

### 1.2 Eğlence Kaynağı — Dürüst Tespit

| Katman | Eğlence payı | Açıklama |
|---|---|---|
| Taktik düello (mevcut) | **~%90** | Eğlence zaten BURADA: taş-kağıt-makas 9-birim, bölge-puanı turtle-kırıcı, temiz komutan. |
| Açık-dünya (yeni) | **~%10 ama çarpan** | Düelloya **amaç + sonuç + ilerleme** ekler (veteran-carry, rütbe-XP, fetih). Güçlü duygusal çarpan. |

**KRİTİK EĞLENCE METRİĞİ:** Oyuncunun BİZZAT oynadığı düello sayısı / toplam-tur **≥ %50** olmalı.
Aksi halde oyun "düello oyunu" değil "**bildirim okuma oyunu**" olur. Bu yüzden MVP'de devlet sayısı **6-8'de kilitli** (40 değil).

### 1.3 Temel Tasarım Kararları

- Devletler **gerçek dünya DEĞİL** → tamamen prosedürel RPG-varlıkları (seed'den isim/arma/stat/kişilik/lider).
- Harita **GÖRSEL devasa** ama **MANTIK olarak 12-40 düğümlü soyut komşuluk grafiği** (pathfinding/ikmal YOK).
- AI-vs-AI çatışmaları `spRunMatch` ile arka planda **auto-resolve** → "AI da RPG yapar" bedava gerçekleşir.
- 4 çağ = **TEK motor + 4 VERİ-paketi** (roster reskin + STAT override + palet), farklı mekanik DEĞİL.
- Kalıcılık **affedici**: yenilgi geri-alınabilir aksilik, run-ender değil.
- **DÜRÜST kapsam:** 4-çağ-aynı-anda = solo-dev ölümü. **MVP = 1 çağ tam-pişmiş**, diğer 3 = veri-genişlemesi.

---

## 2. Görsel: Pixel-Avrupa Haritası

> **Uyarı (kritik):** MetaMap tasarımda "1 paragraf" gibi görünür ama gerçekte **2-3 haftalık tek başına alt-proje** ve en sinsi efor-yutan parçadır. Yol haritasında **ayrı faz** olarak ele alınır (Faz 2'nin içinde tek madde değil).

Yeni dosya: `js/MetaMap.js`. PHASE'e `META` eklenir.

### 2.1 Kamera Yeniden-Kullanımı (sıfır yeni matematik)

META aktifken global `camera = META.camera`, `zoom = META.zoom` swap'lanır. Mevcut `screenToWorld` / `worldToScreen` / wheel-zoom / `clampCamera` / `updateCamera` (WASD + kenar-kaydırma) **DEĞİŞMEDEN** çalışır.

**Tek refactor:** `clampCamera`/wheel içindeki sabit `WORLD_W/H` → `activeWorldW()` / `activeWorldH()` yardımcısı (aktif sahneye göre okur).

```
META.worldW = 12000, META.worldH = 10000   // savaş 3400×2300'den bağımsız BÜYÜK kıta
```

### 2.2 Performansın Kalbi: Off-Screen Cache (2-canvas)

**Sorun:** Mevcut `drawMap()` HER KARE ~950 detay + 360 prop'u tek tek `ctx.fill` ile çiziyor → 50-200 bölgede ÖLÜR.

**Çözüm — 3 katmanlı cache:**

| Katman | Ne zaman üretilir | İçerik |
|---|---|---|
| `buildContinentCache()` | BİR KEZ (çağ/seed değişince) | off-screen canvas (`worldW*0.25 = 3000×2500px`, ~30MB), deniz dokusu + kara zemini + dağ/orman dekoru + il-sınırları. **STATİK.** |
| `buildOwnerLayer()` | sahiplik değişince (`dirtyOwner`) | ayrı off-screen, her il-poligonu sahip-devlet rengiyle `alpha~0.45` + komşu-farklı-sahip kenarları KALIN ülke-sınırı. |
| `drawMeta()` | HER KARE | `drawImage(cache, kırpma)` + `drawImage(ownerLayer, kırpma)` + dinamik katman. **TEK drawImage** ile tüm statik kıta → 200+ bölgede 60fps. |

### 2.3 Kıta Üretimi (silüet-maske + Voronoi HİBRİT)

Saf prosedürel "Avrupa gibi" durmaz; saf-PNG RPG-esnekliği öldürür. **Hibrit yaklaşım:**

- **SİLÜET:** kod-gömülü ~40-nokta Avrupa-benzeri poligon-yol (İber çıkıntısı / İtalya çizmesi / İskandinav / Britanya ada). Kasıtlı abartılı = "gerçek-dünya-değil".
- **İÇ BÖLME:** kara-maske içine `srand(seed)` ile **N Voronoi-tohumu** (`N = devletSayısı × ilPerDevlet`, AYARLAR'dan). Saf-JS Voronoi (yarı-düzlem kesişimi, kütüphane yok, N≤200 anında). Hücreler kara-maskeyle kırpılır (pürüzlü sahil).
- **SAHİP ATAMA:** flood-fill ile her devlete bitişik il-bloğu.

`seededRandom`/`mulberry32` `srand()` **MEVCUT** → her HİKAYE seed'i = tüm harita (paylaşılabilir / tekrar-üretilebilir).

### 2.4 Zoom-LOD (büyük harita hem özet hem detay)

> Bu, "büyük-harita oyanış-tuzağı"na karşı ana savunma: tıklayınca 16 düğüm görüp "küçük" hissetme riskini **LOD + il-isimleri** maskeler.

| Zoom | Görünüm |
|---|---|
| `< 0.5` (kıta) | il-isimleri GİZLİ, sadece devlet-renk blokları + başkent-yıldızları, ordu = küme-rozeti |
| `0.5 – 0.9` (ara) | etiket-alpha enterpolasyonu |
| `> 0.9` (bölge) | il-isim etiketleri (`drawW()*zoom` ölçekli), kaynak-ikonları, tekil ordu-pulları |

### 2.5 Katman Sırası (mevcut disiplin korunur)

```
cachedKıta → ownerLayer → hover-aydınlatma → selectedProv akan-kesikli sınır
  → ordu-pulları → ordu-hareket eğri-okları → tehdit-nabzı(kırmızı)
  → metaFog → metaMinimap → metaHUD
```

### 2.6 Fog + Minimap (mevcut kod uyarlaması)

- **metaFog:** mevcut `fogCanvas` `destination-out` kalıbı → sahip + komşu iller NET, uzak iller puslu, hiç-görülmemiş kapkara.
- **metaMinimap:** `drawMinimap` birebir → kıta + sahiplik-renkleri + viewport-kutusu, minimap-click → reposition korunur.

### 2.7 Çağ Teması Görselde Ucuz (tek geometri, 4 palet)

```js
ERA_THEME = {
  ancient:  { sea:'#2a4a5a', land:okre,        icon:'pillar'  },
  medieval: { sea:'#264a5e', land:MEVCUT-palet, icon:'castle'  },
  modern:   { sea:gri-mavi,  land:olive,        icon:'fort-star' },
  fantasy:  { sea:mor-camgöbeği, land:arcane,   icon:'crystal', glow:true }
}
```

Çağ hikaye-boyunca sabit → cache bir kez. **MVP = (seçilen çağ) tam-cilalı**, diğer 3 = palet-stub.

### 2.8 META ↔ SAVAŞ Görsel Köprüsü

```
İl çatışınca:
  zoom-in anim (META.camera o ile yaklaşır)
  → fade-to-black
  → savaş WORLD_W/H + camera/zoom swap → startBattle()

checkGameOver:
  → fade-back
  → il ownerId güncelle + dirtyOwner=true
  → fetih renk-dalgası (VFX particle)
```

**AYNI ctx, farklı camera/world ayarı — yeni canvas gerekmez.**

---

## 3. RPG-Devlet Sistemi

Yeni dosya: `js/meta/State.js`. **TEK çağ-bağımsız şema**, sayı/kaynak yapılandırılabilir.

### 3.1 `makeState(seed, opts)` Çıktısı

```js
{
  id:'st_07', seed, isPlayer:false,
  name: genStateName(rng, era),        // çağ flavorPack'inden markov-hece
  color: genHeraldry(rng),             // {primary:'#a33', sigil:4} harita+UI arması
  stats:{                              // 0..100 EVRENSEL (çağdan bağımsız)
    military,    // → düello bütçesine çevrilir
    economy,     // → bütçe büyüme + tamir
    population,  // → insan-gücü tavanı (kayıp toparlama)
    stability,   // → düşükse isyan-olay riski
    tech         // → eraTechFloor(era) + sapma
  },
  personality:{ archetype:'agresif|fanatik|dengeli|tüccar|temkinli', aggression, risk, greed },
  leader:{ name, rank:eraRankWord(era,lvl), level, xp, traits:[1-2] },
  treasury, warfunds: baseWarfunds(military, abundance),  // → DÜELLO BÜTÇESİ
  provinces:[], veterans:[{type:T.ARMOR, xp, count}], roster: eraRoster(era),
  relations:{ st_03:-40 }, goals:['attack:st_05']
}
```

### 3.2 Düello Köprüsü — Sistemin Can Damarı (saf fonksiyon, sızıntı-kilidi)

```js
stateToBattleConfig(state, contestedProvince) {
  budget = warfunds * (1 + military/200) * (isHomeland ? 1.25 : 1.0);   // savunma avantajı
  personality = {
    agresif:'agresif', fanatik:'agresif',
    dengeli:'dengeli',
    tüccar:'temkinli', temkinli:'temkinli'
  }[archetype];
  geneOverrides = traitsToGenes(leader.traits);  // 'Kuşatmacı'→rushArtyK↓, 'Soğukkanlı'→decisionMs↑
  return { budget, personality, geneOverrides, veterans, roster, terrainBias };
}
```

**Çağrı zinciri:** `commanderSetPersonality(cfg.personality)` → `warfunds → player/enemy.money` → `startBattle()`.
Bitince `applyBattleOutcome(won)` ile sonuç geri-yazılır.

> **ALTIN-TEST (her commit'te `console.assert`):** aynı `state` + aynı `seed` → **byte-aynı** `battleConfig`. Bu, meta-state'in düelloya kaçak sızmasını engelleyen en sinsi tutarlılık-bug'ına karşı tek savunmadır.

### 3.3 Prosedürel Üretim — Yapılandırma (sayı + bolluk TEK çarpan-üçlüsü)

```js
generateEurope({ stateCount:4..40, abundance:'kıt|normal|bol', era, worldSeed }) {
  ab = {
    kıt:    { power:35, wealth:30, gold:600,  mult:0.8 },
    normal: { power:50, wealth:50, gold:1000, mult:1.0 },
    bol:    { power:65, wealth:70, gold:1800, mult:1.3 }
  }[abundance];
  for (i in stateCount) states.push(makeState(worldSeed*1000 + i, ab));
  seedRelations(states);  // başlangıç +rakip / -müttefik
}
```

| Konfigürasyon | Emergent zorluk |
|---|---|
| 20-devlet + kıt | zorlu hayatta-kalma |
| 4-devlet + bol | rahat fetih |

→ **EMERGENT zorluk**, ekstra denge-kolu YOK.

> **MVP KISITI:** Devlet-sayısı slider üst-sınırı MVP'de **20** (40 değil). 40×10=400 tahmin/tur + auto-resolve perf riski doğrulanmadan 40 açılmaz.

### 3.4 Kişilik ↔ Komutan-Genom (yeni AI YAZILMAZ)

Mevcut `Commander.js` `COMMANDER_PERSONALITIES{dengeli, agresif, temkinli}` + TURTLE/AGGRO presetleri 5 arketipi **karşılar:**

| Arketip | Komutan eşlemesi |
|---|---|
| agresif (agg 0.8) | `agresif` |
| fanatik (0.95) | `agresif` + `reserveShare:0` |
| dengeli (0.5) | DEFAULT |
| tüccar (0.4) | `temkinli`, bütçe-büyük |
| temkinli (0.25) | turtle, `schwerpunktK↑` |

Her devletin savaş-tarzı stat'larından **deterministik türer** = "AI da RPG yapacak" **sıfır-ekstra-AI** ile.

### 3.5 İsim / Lore (çağ flavorPack markov)

| Çağ | İsim örneği | Unvan |
|---|---|---|
| Eski | `Lat- / Aqu- / -ia / -um` | Konsül |
| Orta | `Wald- / Burg- / -mark / -heim` | Dük |
| Yeni | (ulus-flavor) | Mareşal |
| Fantezi | `Vael- / Mor- / -dûn` | Ejderlord |

Heraldry = seed'den pixel-arma. Lore = stat-şablonu ("yüksek-askeri + düşük-istikrar = militarist-çalkantılı krallık").

---

## 4. Dünya-AI

Yeni dosya: `js/WorldAI.js`. Taktik komutandan **AYRI** üst-katman, hilesiz, `spRunMatch`'i silah olarak kullanır.

### 4.1 Sıfır Yeni Motor: `spRunMatch` HAZIR

`SelfPlay.js`'teki `spRunMatch(red, blue, blueCounts, maxTicks, replay, matchSeed)` tam-headless + deterministik. Döndürür: `{winner, redValueLost, blueValueLost, redVp, blueVp, decisive}`.

`worldAutoResolve(attCounts, defCounts, regionId, turn, attVet, defVet)` sarmalayıcısı:
```js
seed = (regionId*73856093 ^ turn*19349663) >>> 0;
// iki-tarafı-da-sabitleyen spRunHeadlessMatch varyantı
// veteranlık = hp × (1 + 0.3×vet)
return { winnerIsAttacker, attLost, defLost };
```
`world.garrison.counts[9]` ZATEN `spDeployArmy` `[9]`-dizi formatı → bütçe yerine doğrudan **birim-sayısı** geçilir.

### 4.2 Her AI-Devletinin Tur Döngüsü (deterministik, 5 faz)

| Faz | Ad | İçerik |
|---|---|---|
| A | **ALGILA** (hilesiz/sisli) | kendi + komşu NET; uzak = `gerçekGüç × (0.7 + 0.6×seedHash(ai,region,turn))` → AI "fazla-bilen-tanrı" OLMAZ, bazen yanlış-hesaplar = insan-gibi. |
| B | **ÖNCELİK SKORLA** (personality-ağırlıklı utility) | GENİŞLE(`bölgeDeğeri×expansionism − zayiat×caution`) / SALDIR(`winProb×bölgeDeğeri − zayiat×caution − diploCezası×honor`) / SAVUN(`tehdit×survivalInstinct`) / EKONOMİ(`treasuryFazlası×greed`) / DİPLOMASİ(`ortakDüşman×pragmatism`). |
| C | **KAZANMA-TAHMİNİ 2-KATMAN** (perf bel-kemiği) | **HIZLI-KATMAN:** kapalı-form `forceRatio = Σ cost × counterBonus` (effHP-ağırlıklı, STATS strong/weak), `winProb ≈ logistic(ratio)` — `spRunMatch` ÇAĞIRMADAN ~5ms'de 400 aksiyon eler. **AĞIR-KATMAN:** sadece SEÇİLEN 1-2 gerçek savaş için `spRunMatch` → gerçek winner + zayiat. |
| D | **SEÇ & UYGULA** | en yüksek util. Ordu = `garrison.counts` transferi (komşu bölge). Savaş → ağır-katman → kaybeden bölge el-değiştirir + iki-tarafa zayiat. |
| E | **HAFIZA** | relations güncelle (saldırıya-uğradım → +nefret), `memory.lastAttackedBy`. |

**Perf:** 40-devlet × 10-aday = 400 ucuz-tahmin ama ~10 gerçek-çatışma/tur.

### 4.3 Oyuncu Köprüsü

```
Oyuncu-DAHİL çatışma  → CANLI startBattle (oyuncu OYNAR)
Oyuncu-DIŞI AI-vs-AI  → arka-planda worldAutoResolve
                        + ekran bildirimi "⚔ Fransa→Bavyera kazandı, ağır zayiat"
```

`requestIdleCallback` ile chunk'lanır (tur-başı 1-2 savaş çöz, UI donmaz).

> **PERF + DETERMİNİZM ÇATLAĞI (kritik):** `spRunMatch` `snapshotSIM`/`restoreSIM` ile CANLI sim-state kullanır. Tur-başı 10 gerçek-çatışma × snapshot = ana-thread donma riski. **`snapshotSIM`'in canlı-units dizisini bozmadığından %100 emin olunmalı** (`units` const ama içerik mutable — snapshot derin-kopya mı?). NODE-test-YOK ortamında **runtime `console.assert`** tek savunma: her snapshot sonrası `assert(units.length sabit, SIM.rng.state geri-yüklendi)`.

### 4.4 AI-Kişiliğini GÖRÜNÜR Kılma (ucuz rafine)

Sorun: oyuncu AI'nın arketipini sadece düello-komutan-tarzından hisseder, harita-davranışından değil.
**Ucuz çözüm:** her AI-turunda **1-satır "niyet" bildirimi** ("Bavyera-Dükü topraklarını genişletmeye aç görünüyor"). Sıfır-yeni-AI, sadece **util-skor → metin eşlemesi.** "AI da RPG yapar" vaadini ucuza gerçek-kılan parça.

### 4.5 Zeka Kademesi (solo-dev dengesi)

| Sürüm | Kapsam | Açıklama |
|---|---|---|
| **v1 (MVP, 2-3 gün)** | greedy utility-skor, tek-tur lookahead, 6-eksen personality | "akıllı görünür" çünkü gerçek-counter-matrisini kullanır ("tanklarım onların tanksavarına yem olur"). |
| v2 | 2-tur minimax + Schwerpunkt | Foresight.js felsefesini dünya-ölçeğe: tüm gücü TEK bölgeye yığ. |
| v3 (LÜKS, opsiyonel) | personality-genomları self-play LİG'inde evrimleştir | |

### 4.6 Solo-Dev Tuzaklarından Kaçın

- Gerçek pathfinding YOK (soyut graf-transfer).
- Tam-diplomasi-ağacı YOK (relations-sayısı + at-war-list).
- Her-AI-savaşını TAM-çözme YOK (hızlı-katman eler).
- AI'ya tam-bilgi YOK (sisli-tahmin = felsefi tutarlılık).

---

## 5. Ana Ekran & UI Akışı

Yeni dosya: `js/Screens.js` (globals.js'ten SONRA, main.js'ten ÖNCE yüklenir).

### 5.1 Screen Router

```js
const SCREEN = { MAIN, QUICK_SETUP, DUEL, STORY_SETUP, WORLDMAP, SETTINGS };
let currentScreen = SCREEN.MAIN;
let returnAfterDuel = null;
let pendingBattleCfg = null;
```

`phase` ARTIK sadece **DUEL-içi alt-durum** (DEPLOY/BATTLE).

### 5.2 showScreen Grafiği

```
                    ┌──────────────────────────────┐
                    │           MAIN                │
                    │  [📜 YENİ HİKAYE]             │
                    │  [⚔️ HIZLI MAÇ]              │
                    │  [⚙️ AYARLAR]                │
                    └──┬─────────┬─────────┬───────┘
                       │         │         │
        ┌──────────────┘         │         └──────────────┐
        ▼                        ▼                        ▼
  ┌───────────┐          ┌─────────────┐           ┌───────────┐
  │STORY_SETUP│          │ QUICK_SETUP │           │ SETTINGS  │
  │ devlet→çağ│          │ puan+harita │           │ sayı/bolluk│
  │ →5 soru   │          └──────┬──────┘           │ /ses      │
  └─────┬─────┘                 │                  └─────┬─────┘
        │                       ▼                        │
        ▼                  ┌─────────┐                   │
  ┌───────────┐  fetih────>│  DUEL   │<─── oyuncu-dahil  │
  │ WORLDMAP  │<───────────│ (deploy │     çatışma       │
  │ (meta)    │  fade-back │ +battle)│                   │
  └───────────┘            └────┬────┘                   │
        ▲                       │ checkGameOver           │
        └───────────────────────┘                        │
        (returnAfterDuel)                                 │
   <───────────────────────────────────────────── geri ──┘
```

```js
showScreen(next) {
  ALL_SCREEN_EL.forEach(el => el.hidden = true);   // declarative = HUD-sızıntısı yok
  SCREEN_DOM[next].forEach(el => el.hidden = false);
  canvas.style.display = (next===DUEL || next===WORLDMAP) ? 'block' : 'none';
  if (next===DUEL)     enterDuel();
  if (next===WORLDMAP) enterWorldmap();
}
```

`SCREEN_DOM` haritası:
- `duel` → `[ui-resources, ui-phase, ui-spawn-bar, minimap, gameCanvas, start-btn]`
- `worldmap` → `[worldmap-hud, gameCanvas]`
- `main` → `[main-menu]`

### 5.3 Ana Menü DOM

`#main-menu`: `position:absolute; inset:0; z-index:90`. Mevcut `game-over-box` stilini taklit (Press Start 2P). Pixel-Avrupa parallax arka-plan. SAĞDA dikey butonlar:

```
[📜 YENİ HİKAYE — Avrupa'da devlet seç, çağını belirle]   (primary, yeşil-border)
[⚔️ HIZLI MAÇ — anında 1v1, puan+harita seç]
[⚙️ AYARLAR — devlet sayısı, kaynak bolluğu, ses]
```

**Kablolama BİR KEZ (idempotent `.onclick`, `addEventListener` DEĞİL → çift-listener yok).** `showScreen` ASLA listener eklemez, sadece görünürlük.

### 5.4 resetBattleState() — KRİTİK SIZINTI-KİLİDİ (reload yerine)

> Mevcut tek temizleme `location.reload()` (main.js:259) açık-dünyada **ÖLÜMCÜL** (dünya-state uçar). Bu fonksiyon ŞART.

`units`/`player`/`enemy`/`SIM` modül-const → yeniden-ATANAMAZ → **YERİNDE temizle** (referans korunur, `SIM.units = units` aynı diziyi görmeye devam eder):

```js
units.length = 0; trenches.length = 0;
SIM.controlPoints.length = 0; SIM.vpWinner = null;
player.money = 0; player.kills = 0; enemy.money = 0;
selectedSpawnType = null; supportCooldowns.paradrop = 0;
gameTime = 0; particles.length = 0; decals.length = 0;
commanderReset(); layeredAI.reset();
// game-over-screen.hidden; canvas ghost-cursor kaldır;
console.assert(units.length===0 && trenches.length===0, 'SIZINTI!');
```

Her `enterDuel` + `enterWorldmap` başında çağrılır.

### 5.5 gameLoop GUARD (main.js:910 başına)

```js
if (currentScreen !== DUEL && currentScreen !== WORLDMAP) {
  requestAnimationFrame(gameLoop); return;   // menüde sim/çizim DURUR
}                                             // (yoksa GAME_SPEED=4 boş-savaş simüle eder, state bozar, CPU yanar)
if (currentScreen === WORLDMAP) { drawWorldMap(); requestAnimationFrame(gameLoop); return; }
```

### 5.6 Story Wizard (çok-adım, tek-container innerHTML)

```
Adım 0: devlet-seç (pixel-Avrupa veya 8-12 kart)
Adım 1: ÇAĞ-seç (4 kart, MVP'de 3'ü "🔒 YAKINDA")
Adım 2+: çağa-göre dinamik sorular (ERA_QUESTIONS[era])
→ "Hikayeyi Başlat" → WORLDMAP
```

### 5.7 Düello Bitişi

`game-over-screen`'e `#duel-exit-btn` ekle:
```js
fromStory
  ? (resolveStoryBattle(SIM.vpWinner), showScreen(WORLDMAP))
  : showScreen(returnAfterDuel || MAIN);
```
`location.reload` restart-btn'i **KALDIRILIR.**

**Açılış:** `Screens.js` sonu `showScreen(SCREEN.MAIN)` → oyun artık deploy'la değil **ANA MENÜYLE** açılır.

---

## 6. Hızlı Maç

Yeni dosya: `js/QuickMatch.js`. Meta-bypass, hikaye-state'e **DOKUNMAZ**, sandbox izole.

### 6.1 Puan → Bütçe Formülü (asimetri = zorluk)

```js
const QM = { POINT_UNIT:100, MIN:5, MAX:40, pointsToBudget: p => Math.round(p)*100 };
```

Mevcut `1500 = 15-puan` dengeli referans. İki slider: **BİZİM PUAN** (5-40, vars.15) + **AI PUANI** (5-40, vars.15).

| Oran `r = aiPuan/bizimPuan` | Rozet |
|---|---|
| `≤ 0.7` | KOLAY |
| `0.7 – 1.15` | DENGELİ |
| `1.15 – 1.5` | ZOR |
| `> 1.5` | KABUS |

Presetler: `[Kolay AI-%30]` `[Eşit]` `[Zor AI+%50]`.

### 6.2 Köprü (aiDeploy'a DOKUNMA)

```js
startQuickMatch(cfg = {ourPoints, aiPoints, mapId}) {
  applyMap(cfg.mapId);
  player.money = pointsToBudget(cfg.ourPoints);
  enemy.money  = pointsToBudget(cfg.aiPoints);
  phase = DEPLOY;
}
```

`aiDeploy()` (AI.js:9) `enemy.money`'yi ZATEN okuyor → **asimetrik bütçe BEDAVA, sıfır kod-değişikliği.** Opsiyonel "Otomatik Diz" → `spRandomArmy(budget)` (SelfPlay.js:45 zaten var).

> **Zorluk = ASİMETRİK BÜTÇE prensibi (kodla bedava):** `aiDeploy` `enemy.money` okuduğu için hile-YOK organik-zorluk. **Aynı prensip Hikaye'de de** kullanılır — zorluk AI-bütçe-çarpanı, asla görüş/para-hilesi değil.

### 6.3 10 Harita (önce refactor: const→let + applyMap)

**ÖN-KOŞUL REFACTOR:** `WORLD_W/H`, `terrainFeatures` (const→let), `playerZoneY = WORLD_H*0.6` (`isInPlayerZone` bunu okur, globals.js:538), `initControlPoints` konumları (ControlPoints.js:21) → tek `applyMap(mapDef)`'e topla, `groundTiles`/`groundDetails` üretimini de içine al. **Sim-mantığı değişmez.**

| # | Harita | Tema | Özellik |
|---|---|---|---|
| 1 | Arena | green | simetrik-referans, 3-nokta |
| 2 | Geçit | green | merkez-choke, topçu/AT-lehine |
| 3 | Bozkır | desert | sparse, tank-manevra |
| 4 | Orman | green | dense-forest, piyade-lehine |
| 5 | Nehir | green | yatay-bant + 2-köprü |
| 6 | Yayla | snow | scattered-hills, effHP-doktrini parlar |
| 7 | **Kale** | green | **ASİMETRİK-handikap**, güney-savunma (etiketli) |
| 8 | Vaha | desert | center-cover, merkez-kritik |
| 9 | Tundra | snow | dikey-koridor, derinlik |
| 10 | Rastgele | proc | procedural-seed, "Yeniden Üret" düğmesi |

**applyMap 4-katman:**
1. boyut + zon (asym_def'te `h*0.45`)
2. terrain-reçetesi `srand`'la üretir, **AYNA-simetrik** (bir yarı üret + y-yansıt)
3. kontrol-noktaları `map.points`'e göre (1=merkez, 2=sol/sağ, 3=üçlü)
4. BİOME **SADECE-RENDER** (green/desert/snow paleti, SIM'e SIFIR etki)

### 6.4 Denge Güvenliği

10'un 8'i + prosedürel **AYNA-simetrik** (kuzey-güney özdeş) = adalet garantisi, denge-test yükü sıfır. Sadece **#7 Kale** bilinçli-asimetrik, UI'da etiketli. Su/nehir = görsel mavi-bant ama sim'de **FOREST-yavaşlama proxy'si** (yeni-mekanik borcu yok).

### 6.5 Ekran (tek-panel, mevcut DOM-idiom)

HIZLI MAÇ tık → tek-panel overlay: iki slider + zorluk-rozeti + 10 harita-kart-grid (120×80 thumbnail = mevcut `drawMinimap` mantığı). "SAVAŞA BAŞLA" → `startQuickMatch` → DEPLOY → start-btn → `startBattle` → `checkGameOver`. Sonuç restart = "Yeni Hızlı Maç" (ana-ekrana, world-state'e dokunmaz).

---

## 7. Hikaye Modu + 4 Çağ

### 7.0 Çağların ORTAK Motoru (kritik fizibilite kazanımı)

Düello tip-bağımsız **STAT'tan** çalışıyor (globals.js:294 STATS, strong/weak dizileri, `getSquadRole`/`calculateUnitDamage`). Sonuç: **4 çağ AYNI FORGE-Core'da "roster reskin + STAT override"** = FİZİBİL, farklı mekanik motor YAZILMAZ.

**ROSTER-AS-VERİ** (`js/Ages.js` TEK kaynak):

```js
const AGES = {
  medieval: {
    spriteRow: 2, palette: 'steel',
    roster: { [T.ARMOR]:'Kuşatma Kulesi', [T.ARTILLERY]:'Trebuşe', [T.ANTI_TANK]:'Tatar Yayı', ... }
  }
};
```

Savaş başında `applyAgeOverride(STATS, age)` ile **ÇAĞ-KOPYASI** türetilir, orijinal STATS **DOKUNULMAZ** (düello-determinizmi korunur).

**4 cerrahi-dokunuş:**
1. `Unit.js:69` → `sy = (AGES[age].spriteRow + isRed) * satır`
2. STATS okuması → `applyAgeOverride`
3. UI etiketleri `AGES.roster`'dan
4. strong/weak çağ-opsiyonel-override (taş-kağıt-makas KORUNUR: eğitilmiş komutan-beyni çağlar-arası **TRANSFER**, sıfırdan-balans YOK)

**İLERİ-MİMARİ (2. çağ'dan ÖNCE):** `T.ARMOR`/`T.ANTI_TANK` hardcode'larını **role + tags** etiketlerine soyutla (`tags:['armored','antiArmor','splash']`) → `AT_ARMOR_MULTIPLIER` tag-tetikli, her çağ ~80-satır JSON, AI tag-uzayında **transfer**.

> **KURULUM-SORULARI sadece BAŞLANGIÇ-CONFIG ayarlar** (roster-kilit + bütçe-çarpan + biome + arketip), yeni-mekanik YOK = ucuz-çeşitlilik.

---

### 7.1 ESKİ ÇAĞ `id:'eski'` — spriteRow 0, palette bronze/okre

**ÖZELLİK:** ağır-piyade baskın (lejyon/falanks), kuşatma-yavaş, küçük-devletler-çok + teknoloji-yavaş, menzil×0.7 (yakın-dövüş hissi).

**ROSTER reskin:**
| Baz birim | Eski Çağ |
|---|---|
| Piyade | Lejyoner (kalkan-duvarı) |
| Hafif Süvari | Atlı |
| Zırhlı | Falanks (mızrak-duvarı, süvariye-sert) |
| Keşif | Atlı-Keşif |
| İstihkam | Palisad |
| Şifacı | Rahip |
| Tank | Savaş Filleri (menzilsiz-şok) |
| Tanksavar | Mızraklı (fil-avcısı) |
| Topçu | Mancınık / Balista |

**KURULUM SORULARI:**
1. **Medeniyet?** [Roma=lejyon-disiplin +%10 piyade-hp / Yunan=falanks-ucuz / Pers=süvari+okçu-bolluğu / Kartaca=fil+paralı-asker]
2. **Yönetim?** [Cumhuriyet=ekonomi+ / Tiranlık=başlangıç-ordu+ ama isyan-riski]
3. **Lejyon Doktrini?** [Disiplin=cohesion+ / Falanks=savunma+]
4. **Tanrı himayesi?** [Savaş=atk+ / Bereket=bütçe+ / Bilgelik=keşif-görüş+]
5. **İlk düşman?** [Barbarlar=kolay-küratör / Rakip-imparatorluk=zor]

---

### 7.2 ORTA ÇAĞ `id:'orta'` — spriteRow 2, palette steel

**ÖZELLİK:** şövalye-süvari şoku, kale-fort baskın (fortLevel önemli), veraset-krizleri, din-faktörü (haçlı-olayları).

**ROSTER reskin:**
| Baz birim | Orta Çağ |
|---|---|
| Piyade | Yaya Asker |
| Hafif Süvari | Hafif Atlı |
| Zırhlı | Şövalye (şok) |
| Keşif | Akıncı |
| İstihkam | Kuşatmacı |
| Şifacı | Keşiş |
| Tank | Kuşatma Kulesi |
| Tanksavar | Tatar Yayı |
| Topçu | Trebuşe |

**KURULUM SORULARI:**
1. **Hanedan kökeni?** [yerli-soylu / fatih-yabancı / taht-gaspçı — farklı diplomasi-başlangıcı]
2. **Din?** [Hristiyan=keşiş-iyileştirme+ / Pagan=akıncı-hız+ / haçlı-yemini=kuşatma+]
3. **Yönetim?** [Feodal=vasal-isyan-riski / Merkezi=güçlü-merkez]
4. **İlk kalenin konumu?** [nehir=savunma+ / geçit=ticaret+ / tepe=görüş+ — HARİTA-preset + başlangıç-arazi seçer]
5. **Şövalyelik mi sayı mı?** [az-elit-zırhlı / çok-ucuz-yaya — roster-ağırlığı]

---

### 7.3 YENİ ÇAĞ `id:'yeni'` — spriteRow 4, palette olive/gri-mavi — **+0 SANAT**

**ÖZELLİK:** barut-devrimi (topçu/tanksavar erken+güçlü), industry-kaynağı baskın, hızlı-tech, devrim-olayları, atış-hızı×1.2.

**ROSTER = MEVCUT default isimler** (Piyade / Mekanize / Zırhlı-Piyade / Keşif / İstihkam / Şifa / Tank / Tanksavar / Topçu). **Sıfır reskin.**

**KURULUM SORULARI:**
1. **Ulus-doktrini?** [Prusya=topçu-disiplin / Fransa=süngü-hücum-moral / İngiltere=hat-ateşi-menzil]
2. **Sanayi mi tarım mı?** [sanayi=pahalı-güçlü-üretim / tarım=ucuz-kitle]
3. **Devrim mi monarşi mi?** [devrim=moral+ ama kararsız / monarşi=istikrar]
4. **Hat mı manevra mı?** [hat-piyade-savunma / mekanize-manevra]
5. **Sömürge geliri?** [var=bütçe+ ama 2-cephe / yok=tek-cephe]

---

### 7.4 FANTEZİ ÇAĞI `id:'fantezi'` — spriteRow 6, palette arcane/mor-camgöbeği + glow

**ÖZELLİK:** büyü = **YENİDEN-SKİNLENMİŞ** topçu(splash) / iyileştirme(medic) — yeni-motor YOK, efsane-birimler, ırk-modifier-paketi.

**ROSTER reskin:**
| Baz birim | Fantezi |
|---|---|
| Piyade | Kılıç Eri |
| Hafif | Kurt Binici |
| Zırhlı | Ork Berserker |
| Keşif | Elf Gözcü |
| İstihkam | Cüce Tamirci |
| Şifacı | Şifa Büyücüsü |
| Tank | Ejderha |
| Tanksavar | Ejderha-Avcısı Okçu |
| Topçu | Büyü Topu |

**KURULUM SORULARI:**
1. **Irk?** [İnsan=dengeli / Elf=okçu-menzil+görüş / Ork=hp+saldırı-ucuz / Cüce=zırh+yavaş+topçu — STATS-modifier paketi]
2. **Büyü-okulu?** [Ateş=splash+(topçu) / Buz=düşman-speed− / Şifa=medic-güçlü / Kara=ölüleri-dirilt(kayıp-azalt)]
3. **Ejderha-yumurtasının kaderi?** [kuluçka=geç-ama-güçlü-ejderha / sat=erken-bütçe / kült-kurban=kalıcı-buff]
4. **Eski düşman?** [Ölüler-ordusu / Rakip-krallık / Ejderha-sürüsü — kampanya-küratörü]

**TEK gerçek-yeni-mekanik adayı (MVP-SONRASI, opsiyonel):** uçan-Ejderha = arazi-yavaşlamasını-yoksay bayrağı.

---

## 8. Ekonomi & İlerleme & Kalıcılık & Save

### 8.1 Tek-Save Şeması (~3-5KB)

> **KRİTİK NAMESPACE DİSİPLİNİ:** Mevcut localStorage ZATEN `GENOME_KEY`/`cmdrGenome`/`cmdrHall`/`AI_DOCTRINE_STORAGE_KEY`/`MEMORY_KEY` kullanıyor (SelfPlay.js:434,816,754 + LayeredAI.js:492). Yeni save-şeması bu **AI-öğrenme anahtarlarına ASLA dokunmaz** — yoksa "Yeni Hikaye" AI-beynini siler = regresyon. Faz-2 başında **yazılı-test** edilir.

| Anahtar | İçerik | Yenilgide |
|---|---|---|
| `pixelRtsWorld` | sefer-state | sıfırlanabilir |
| `pixelRtsCommander` | komutan (rank/perk/unlock/score) | **KORUNUR** (ayrı anahtar) |
| `GENOME_KEY` vb. | AI-öğrenme | **DOKUNULMAZ** |

```js
world = {
  v:1, seed, age:'orta', ageMods:{}, day, playerStateId,
  states:{}, cities:{},
  treasury:{ gold, manpower, industry },
  commander:{ rank, xp, perks, unlocks },
  reserveArmy:{}, scoreCumulative
};
```

### 8.2 Ekonomi: Bütçe-Köprüsü (globals.js:355 TEK-dokunuş, geri-uyumlu)

```js
player.money = world
  ? (BASE + cityIncome + commander.rank*120 + perkBonus − manpowerPenalty)
  : 1500;
enemy.money = world
  ? region.garrisonValue * (0.95 + 0.04*commander.rank)
  : 1500;   // HİLESİZ ~başabaş, görüş/para-hilesi YOK, zorluk organik counter-deploy'dan
```

**ÜÇ-KAYNAK** (bolluk AYARLAR'dan `resourceMult ∈ {0.5 kıt, 1 normal, 2 bol}`):
| Kaynak | Etki |
|---|---|
| GOLD | → deploy-bütçesi |
| MANPOWER | → birim-SAYISI tavanı (para olsa bile birim bitince ordu kuramazsın → kuvvet-ekonomisini META'da MEKANİK zorlar, çöp-ordu-spam cezalı) |
| INDUSTRY | → tech-kademe + fort-hızı |

Cost-tablosu (40-200) ZATEN birim-para-birimi, yeni-icat yok.
> **MVP: TEK-kaynak (gold) başla, manpower Faz-4.**

### 8.3 İlerleme: Komutan-XP = Kuvvet-Ekonomisi (Telemetry.js:36 BEDAVA bağla)

`netValue = enemyValueDestroyed − lossAversion × aiValueLost` ZATEN var.

```js
// checkGameOver callback:
xp = enemyDestroyed − playerLost*1.5 + vpMargin*0.5;
// İNTİHAR-galibiyet az-XP, VERİMLİ-zafer çok-XP (pyrrhic otomatik-cezalı = oyunun ruhu meta-ödüle kodlanır)
scoreCumulative += Math.max(0, xp);
```

**6 RÜTBE** (eşik `0/400/1000/1800/2900/4300`) × max-3 aktif **perk** (deploy-öncesi pasif, STATS-KLONU çarpanı, determinizm korunur):

| Perk | Etki |
|---|---|
| Schwerpunkt | ana-çaba +%10 |
| Lojistik | +200 ₿ |
| Çelik-Duvar | +1 zırh |
| Hızlı-Seferberlik | +3 manpower |
| Pusucu | ilk-flank +%15 |
| Kanaat-Önderi | panik-direnci +%25 |

**BİRİM-KİLİDİ:** başlangıç 6-temel, Tank/Tanksavar/Topçu rütbe + industry ile açılır.
**TECH** (3-dal × 4-kademe, genome'a DOKUNMA): paralel `techMods` çarpan-tablosu, `birim = baz × techMods × ageMods × perkMods` (zincir, orijinal STATS bozulmaz).

### 8.4 Affedici Kalıcılık (yenilgide ne gider / kalır)

| Sonuç | Etki |
|---|---|
| **KAZANINCA** | sağ-kalan → veteran-buff'lı `reserveArmy` (bedava) / şehir fethedilir / komutan birikir / gold birikir |
| **KAYBEDİNCE (AFFEDİCİ)** | sağ-kalanların **%50'si `reserveArmy`'de KALIR** (tamamı değil) / **SADECE saldırılan-bölge el-değiştirir** (imparatorluk durur, capital düşmedikçe oyun bitmez) / komutan-rank/perk/unlock/score **KORUNUR** / treasury %30 yağmalanır |

Yenilgi = **geri-alınabilir aksilik, run-ender DEĞİL.**

**AYARLAR'da 3-ton:** AFFEDİCİ / SERT (bölge + %80-ordu) / IRONMAN (roguelike-sıfırla).
> **MVP'de SADECE AFFEDİCİ-ton ship et** — sert/ironman Faz-4.

### 8.5 Yaşayan Dünya (auto-resolve BEDAVA)

`spreadFactions(day)`: her N-günde en-agresif AI komşu-tarafsıza yayılır (turtle-oyuncuya dünya-baskısı, oturup-beklemeyi cezalandırır). AI-vs-AI çatışma `spRunMatch` headless <1sn. Bölge-seed = `world.seed ^ region.id` → "reload-edip-kolay-harita" istismarı KAPANIR.

> Capital-düşene-kadar-oyun-bitmez kuralı **spreadFactions turtle-baskısıyla** dengelenir ki oyuncu oturup-beklemesin.

---

## 9. MVP

**En küçük oynanabilir açık-dünya:** **1 ÇAĞ** (tam-pişmiş) + **6-8 DEVLET** (soyut-Avrupa, 12-16 düğüm) + **4 SİSTEM:**

| # | Sistem | Kapsam |
|---|---|---|
| 1 | **ANA EKRAN + HIZLI MAÇ** | 3-buton menü, puan-slider → money-köprüsü, 10-harita. SIFIR yeni-mekanik. EN-UCUZ-EN-GÖRÜNÜR ilk parça. |
| 2 | **SAHNE-YÖNETİCİSİ + resetBattleState** | Hikaye'den ÖNCE ŞART. Sızıntı-kilidi. |
| 3 | **1-ÇAĞ HİKAYE** | devlet-seç + çağ-seç (1 aktif, 3 "🔒") + 5-soru (sadece config) + soyut-Avrupa graf + TEK-kaynak(gold) + veteran-carry + affedici-kalıcılık. |
| 4 | **BASİT DÜNYA-AI v1** | greedy utility + hızlı-katman forceRatio + AI-vs-AI auto-resolve + spreadFactions. |

**MVP'de OLMAYAN (bilinçli):**
- 4 çağ aynı-anda (sadece 1)
- üç-kaynak (sadece gold)
- gerçek-pathfinding/coğrafya (soyut-graf)
- tam-diplomasi-ağacı (relations-sayısı)
- dünya-AI v2/v3 (greedy yeter)
- sprite-tint-refactor (satır-ata yeterli)
- Fantezi-uçan-mekanik
- sert/ironman ton (sadece affedici)
- 40-devlet (20 tavan)

**Düello-çekirdeği (FORGE-Core, komutan, self-play, render) HİÇ değişmez** — sadece 4-değer enjekte edilir, sonuç sindirilir.

**Her sistem süzgeci:** "düelloyu/sefer-döngüsünü daha-iyi mi yapıyor yoksa dikkat-mi-dağıtıyor?"

---

## 10. Fazlı Yol Haritası

> **Kritik rafine:** Tasarımda **Faz-0 (iki-dosya ikiliği)** ve **ayrı MetaMap fazı** eksikti; aşağıda eklendi.

| Faz | Süre | Hedef | İş |
|---|---|---|---|
| **Faz 0** ⭐YENİ | 1-3 gün | **İki-dosya ikiliğini ÇÖZ** | `pixel-rts-tek-dosya.html` (9316 satır) vs `js/` (15-dosya) DİVERJE etmiş. Ya tek-dosyayı **SİL** (index.html zaten js/ yüklüyor), ya da `cat js/*.js > tek-dosya` **otomatik-birleştirici** yaz. Bu yapılmadan hiçbir yeni-dosya güvenli değil. |
| **Faz 1** | ~1 hafta | Ana ekran + Hızlı Maç | `js/Screens.js` (SCREEN router + 3-buton menü) + `js/QuickMatch.js` (puan-slider köprüsü). REFACTOR: `WORLD_W/H`+`terrainFeatures`+`playerZoneY`+`initControlPoints` const→let + `applyMap()`. `MAPS[10]`. "Otomatik Diz"=`spRandomArmy`. aiDeploy'a DOKUNMA. Geri-uyum: meta-yoksa 1500. |
| **Faz 1.5** | ~3-5 gün | Sahne-yöneticisi + resetBattleState (sızıntı-kilidi) | `location.reload()` kaldır → `showScreen()`+`resetBattleState()`. Mutable-global envanteri çıkar, yerinde-temizle (referans-korur). `console.assert`. gameLoop GUARD. snapshotSIM derin-kopya doğrulaması. |
| **Faz 2** | ~3-4 hafta | 1-Çağ Hikaye (dikey-dilim) | `js/Ages.js` (1 çağ aktif). `js/Story.js` (wizard). `js/meta/State.js` (`makeState`+`generateEurope`+`stateToBattleConfig` SAF-köprü + ALTIN-TEST). `js/WorldMap.js` (6-8-devlet graf). TEK-kaynak(gold)+veteran-carry+affedici-kalıcılık. 2 localStorage anahtarı. Komutan-XP BEDAVA-bağla. |
| **Faz 2.5** ⭐YENİ | ~2-3 hafta | **MetaMap (ayrı faz!)** | `js/MetaMap.js`: off-screen-cache + saf-JS-Voronoi + silüet-maske + LOD + meta-fog + meta-minimap. **En-büyük-tek-iş-parçası** — Faz-2 içinde "bir madde" değil. (Faz 2 ile paralel başlatılabilir ama ayrı izlenir.) |
| **Faz 3** | ~2-3 hafta | Motor tag-soyutlama + 2. çağ | `getSquadRole`/`calculateUnitDamage` T.ARMOR/T.ANTI_TANK hardcode → role+tags (`['armored','antiArmor','splash','scout']`). `AT_ARMOR_MULTIPLIER` tag-tetikli. Her çağ = `AGES[x].units` ~80-satır JSON. AI çağlar-arası TRANSFER, sıfırdan-eğitim YOK. Sprite-satırı-ata (Unit.js:69). 2.çağ JSON + sorular. |
| **Faz 4** | ~2-4 hafta (YALNIZ Faz-2 eğlenceliyse) | Dünya-AI derinlik + üç-kaynak | `js/WorldAI.js` v2 (2-tur minimax+Schwerpunkt+ittifak). spreadFactions tam-aktif. requestIdleCallback chunk. Manpower+industry. Sisli-tahmin. AYARLAR: devlet-sayısı(4-40)+bolluk(kıt/normal/bol)+zorluk-tonu(affedici/sert/ironman). |
| **Faz 5+** | post-MVP (sanat-hızına bağlı) | 3. ve 4. çağ + cila | ESKİ çağ JSON+18-sprite+sorular. FANTEZİ çağ JSON+sprite+ırk-modifier+büyü=topçu-reskin. Opsiyonel: Fantezi-uçan-Ejderha. Opsiyonel sprite-tint-refactor. Dünya-AI v3 self-play-LİG. |

**Toplam OYNANABİLİR-1-ÇAĞ-AÇIK-DÜNYA:** ~**9-13 hafta** (~2.5-3 ay). TÜM-4-ÇAĞ+derinlik+cila: **5-8 ay.**

---

## 11. Fizibilite & Tuzaklar & Çağ-Stratejisi

### 11.1 Kapsam Verdikti

Kullanıcının **TAM vizyonu** (BÜYÜK-Avrupa + RPG-devlet + dünya-AI + 4-ÇAĞ + 2-mod + ekonomi + kalıcılık) gerçekçi olarak **5-8 AY** solo-dev/vanilla. Hepsini-aynı-anda = **2-3× şişme + yarım-kalan-sistemler = OYNANAMAZ.** Fazlanmış 1-çağ-MVP = ~9-13 hafta, her faz sonunda OYNANABİLİR.

### 11.2 Motor Şaşırtıcı-Hazır (doğrulandı, ~9511 satır)

| Mevcut yetenek | Konum | Meta için anlamı |
|---|---|---|
| `startBattle` bütçeyle-deploy | globals.js:355 | bütçe-köprüsü BEDAVA |
| `aiDeploy` counter-ordu (enemy.money okur) | AI.js:9 | asimetrik-bütçe BEDAVA |
| `checkGameOver` win/loss/draw (SIM.vpWinner) | main.js:291 | temiz sonuç-sindirme |
| `spRunMatch`/`snapshotSIM` headless | SelfPlay.js:136/109 | auto-resolve BEDAVA (en büyük risk-azaltıcı) |
| `resetSimRng` deterministik | — | bölge-sabit-harita |

**Çekirdeği SARMAK doğru, REWRITE değil.** Kod bunu destekliyor.

### 11.3 En Büyük Tuzaklar (öncelik sırasıyla)

| # | Tuzak | Çözüm |
|---|---|---|
| 1 | **İKİ-DOSYA İKİLİĞİ** (en sinsi, en az vurgulanan) | `pixel-rts-tek-dosya.html` + `js/` DİVERJE etmiş. Her yeni-dosya manuel-birleştirme borcu. **Faz-0'da ÇÖZ** (sil veya `cat`-birleştirici). |
| 2 | **BÜYÜK-HARİTA OYNANIŞ-TUZAĞI** | 40-devlet → oyuncu bildirim-okur, düello sulanır. MVP'yi **6-8 devlette KİLİTLE**, 40 slider Faz-4'e. "**oynadığım-düello / toplam-tur ≥ %50**" metriği. |
| 3 | **AUTO-RESOLVE PERF + DETERMİNİZM ÇATLAĞI** | `snapshotSIM` canlı-units bozuyor mu? **runtime `console.assert`** (NODE-test-YOK'ta tek savunma). requestIdleCallback chunk. |
| 4 | **METAMAP'İ "TEK-PARAGRAF" SANMAK** | gerçekte 2-3 hafta. **Ayrı Faz 2.5** olarak ele alındı. |
| 5 | **KOMUTAN-KALICILIK ANAHTAR-KARIŞMASI** | yeni save `GENOME_KEY` vb.'ye dokunursa AI-beyni silinir. **Namespace disiplini Faz-2 başında yazılı-test.** |
| 6 | **4-ÇAĞ-AYNI-ANDA = özellik-şişme ölümü** | 1-çağ-MVP. Çağ-soruları MVP-kapsamından çıkarıldı (sadece seçilen çağın 5-sorusu). |

### 11.4 Çağ-Stratejisi (NET ÖNERİ — tasarımın ORTA-önerisi DEĞİŞTİRİLDİ)

> **MVP çağı = YENİ ÇAĞ (modern) olmalı**, ORTA değil.

**Gerekçe (kodla doğrulandı):** mevcut 9-birim roster'ı (globals.js:295-303) ve sprite'lar ZATEN modern. ORTA-çağ MVP demek = ilk-iş 18-sprite (9-tip × 2-takım) yeniden-çizmek + denge-his değişimi = **SANAT-borcu MVP'ye gömülür.** YENİ-çağ ise **"+0 sanat"** ile ship edilir (tasarımın kendi açıkSorular'ı bunu itiraf ediyor).

**Strateji:**
1. Çağ-motorunu **veri-paketi** olarak DOĞRU kur (`applyAgeOverride` + `AGES{}` JSON), ama MVP'de SADECE "yeni" paketi = mevcut-default, **sıfır-reskin.**
2. **İkinci-çağ = ORTA-çağ**, Faz-3'te ekle — o zaman tag-soyutlama ile "çağ=VERİ" olduğunu KANITLA (AI tag-transfer).
3. **ESKİ + FANTEZİ tamamen post-MVP**, sanat-üretim-hızına bağlı, KODA bağlı değil.

**Asıl darboğaz MOTOR DEĞİL SANAT:** `icons.png` 3000×530, 9-tip×2-takım. 4 çağ = 4×9×2 = **72 yeni 300×220 piksel-sanat hücresi = aylar.** Fizibilite KODDAN SANATA taşınır.

### 11.5 Tutarlılık Çatlakları (bilinçli yönetilen)

1. **"BÜYÜK Avrupa" görsel vs "12-40 düğüm" mantık gerilimi** → LOD + il-isimleri maskeler (Bölüm 2.4).
2. **"AI da RPG yapar" vaadi** → düello-komutan-tarzı + harita-niyet-bildirimi (Bölüm 4.4) ile görünür kılınır.

### 11.6 Kesin-Yapma Listesi

4-çağ-aynı-anda · gerçek-coğrafya/pathfinding · tam-tech-tree/bina-inşa · tam-diplomasi-ağacı · prosedürel-sonsuz-dünya · her-çağ-AI-sıfırdan-eğitme (tag-transfer kullan) · sahne-yöneticisini-geç-yazma.

---

## 12. Kullanıcıya Açık Sorular

> Bu kararlar uygulama-başlangıcını ve sanat-bütçesini belirler. Konsey önerileri parantezde.

1. **MVP-çağ kararı:** MVP çağı **YENİ (modern, +0 sanat)** mı olsun (konsey-önerisi, ORTA-çağ sprite-borcunu erteler), yoksa his/tema açısından **ORTA-çağ** mı tercih edersin (sprite-yükü kabul edilerek)?

2. **Sprite-atlas stratejisi:** `icons.png`'ye çağ-başına 2 satır ekleyip "**çağ×takım = 72 hücre**" mi (basit ama devasa-sanat), yoksa **tek-gri-sprite + ctx-tint refactor'u** mu (takım-rengi prosedürel, "çağ×takım"→"çağ" tekiline iner ama büyük refactor)?

3. **Tek-dosya vs js/ ikiliği (Faz-0 kararı):** `pixel-rts-tek-dosya.html`'i **SİL** mi (index.html zaten js/ yüklüyor), yoksa `cat js/*.js`-**otomatik-birleştirici** mi yazalım (tek-dosyayı koru)?

4. **Devlet-sayısı tavanı:** Maksimum oynanabilir devlet-sayısı **40** mı, yoksa (perf + "düello-yoğunluğu" güvenliği için) **20** mi olsun? (Konsey: MVP'de 20 kilitle, 40'ı doğrulandıktan sonra aç.)

5. **Manpower üç-kaynak ekonomisi:** MVP'de **TEK-kaynak (gold)** mu başlasın (konsey-önerisi), yoksa manpower-tavanı (çöp-ordu-spam bekçisi) **baştan mı** gelsin?

6. **Fantezi-çağı özel-mekanik:** Uçan-Ejderha (arazi-yavaşlamasını-yoksay bayrağı = TEK gerçek-yeni-mekanik) **MVP-sonrası mı tamamen-ertelensin** (konsey-önerisi), yoksa Fantezi-çağıyla mı gelsin?

7. **Eğlence-metriği onayı:** "Oynadığım-düello / toplam-tur ≥ %50" tasarım-hedefini kabul ediyor musun? (Bu, açık-dünyanın düelloyu sulandırmasını engelleyen ana koruma.)

---

*Belge sonu. Bu, doğrudan uygulanabilir bir referanstır; her faz sonunda oyun OYNANABİLİR kalır ve düello-çekirdeği HİÇ bozulmaz.*
