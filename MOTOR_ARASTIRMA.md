# Gerçek/AAA Strateji Motoru — Derin Araştırma Raporu

> Kaynak-temelli (WebSearch + kod okuma), anti-halüsinasyon. 4 paralel araştırma alanı + sentez.
> Tarih: 2026-06-27. Ajanlar kodu **gerçekten okuyarak** doğruladı (sahte iddia yok).

## ⭐ Ana Bulgu (dürüst başlık)

**Motoru DEĞİŞTİRME — zaten doğru yoldasın.** ~12.000 satırlık vanilla-JS oyunun, gerçek bir
strateji motorunun çekirdek mimarisine **zaten sahip**:

- **Deterministik lockstep MP** (MP.js: 50ms/20Hz sabit-tick, seed+komut+hash)
- **Seed'li sim-RNG** (mulberry32, `SIM.rng.state` tek tamsayı)
- **İki-katmanlı AI** (Commander.js / LayeredAI.js / Story.js)
- **Headless SelfPlay arenası** (gerçek `stepSim` fiziğiyle — "eğitim ≈ canlı" zaten kurulu, main.js:928)

"AAA" = motor-katmanı değil, **DERİNLİK + CİLA**. Tek-kişi için doğru mimariyle ulaşılır.
Yol = **strangler (kademeli kuşatma)**: yeniden-yazma DEĞİL, her faz tek başına oynanabilir sevk edilir.

## Dört İlke

1. **WEB'DE KAL** — TypeScript + Vite (build) ekle, render'ı **PixiJS v8 (WebGL)**'e taşı, sim'i veri-odaklı yap. Tam-ECS framework **ithal etme**, sadece felsefesini al (entiteler = düz-veri, mantık = fonksiyon).
2. **DETERMİNİZMİ YUKARI TAŞI** — tek sabit-tick + tek seed'li RNG + sabit iterasyon-sırası disiplinini taktik katmandan **Story.js**'e genişlet. Bu; lockstep MP + replay + kaydet/yükle + self-play tuning'i **aynı anda** açar.
3. **AI = KATMANLI UTILITY + KAPALI-DÖNGÜ EVRİMSEL TUNING** — AlphaStar/RL **DEĞİL** (yüz binlerce $, GPU-orduları, lockstep'i kırar). Mevcut SelfPlay arenanı **parametre-evrimine** çevir.
4. **EMERGENT HİKAYE = tipli Kronik + ilişki/kin grafiği + hafif dram-yönetmeni**. LLM yalnızca **opsiyonel, çevrimdışı, süs** (asla karar/state yazmaz).

## Mimari — 4 Katman, Tek Sözleşme

| Katman | İçerik |
|--------|--------|
| **1 — Deterministik Sim Çekirdeği** | Tek sabit-tick `update(dtFixed)`; render salt-okunur/ayrı; TÜM rastgelelik tek seed'li PRNG; TÜM state tek düz-veri ağacı (hashlenen/kaydedilen/senkronlanan budur); sim'de wall-clock/setTimeout YOK |
| **2 — İçerik = Veri** | Birim/tek/harita/**hikaye-olayları** bildirimsel JS-obje modüllerinde (terrainData/techTree/MapData zaten bu yolda); motor tablolar üzerinde generic; yükleme-anı doğrulayıcı (build yok → yazım hatası = sessiz bug) |
| **3 — Sistemler** | Mega-dosyaları (AI.js 2347 / Story.js 1850 / LayeredAI.js 2052) sistem-fonksiyonlarına böl; **deterministik-sıralı olay-otobüsü** ile haberleş (çapraz-çağrı yerine); meta-ajanlar ucuz utility skorlama + tick-modulo zaman-dilimleme |
| **4 — Emergent Anlatı Yönetmeni** | Olay-otobüsüne abone "storyteller"; sim-gerçeklerini (sadakat düşüşü, kin, darbe) isimli rekabet/ihanet/yükseliş-düşüş yaylarına yükseltir; **tarih-günlüğü = emergent kronik** |

**Mevcut sistemlere bağlanış:** Taktik düello zaten determinizm-yetenekli (sadece tek-oyuncuyu akümülatöre yönlendir). MP lockstep **değişmez**. Save = JSON snapshot + saveVersion + sıralı `migrate[]`. Soyut AI-vs-AI savaş = aynı verinin deterministik fonksiyonu → SelfPlay canlıyla birebir.

## AI Tasarımı — 3 Katman, Tek Utility Çekirdeği

1. **STRATEJİK** (üst-harita, tur-bazlı): MCTS + hızlı soyut-savaş çözücü ile ileriye-bakış (Foresight.js'i olgunlaştır). *Total War: Rome II kampanya AI'ı tam bunu yaptı — AAA-kanıtlı.*
2. **OPERASYONEL** (doktrin atama): Utility skorlama (Infinite Axis, Dave Mark & Kevin Dill GDC 2010); mevcut LayeredAI doktrinleri (ADVANCE/ENCIRCLE/BREAKTHROUGH) buna oturur. Opsiyonel hafif HTN.
3. **TAKTİK** (birim yürütme): Utility + dar behavior-tree (kite/sığın/formasyon) — mevcut Commander.js kite mantığı.

**Kapalı-döngü gelişim (gerçekçi):** utility ağırlıklarını/eşiklerini parametrik yap → headless self-play arenanı **evrimsel / N-tuple-bandit tuner**'a çevir. Fitness = **kazanma + denge + çeşitlilik** (sadece kazanma → dejenere tek-strateji). Gece-boyu koştur, kazanan seti "sürüm" yap, AI-merdiveni tut. *Saf JS, GPU yok — "daha az el-ayarı" hedefine birebir + OP-strateji otomatik yakalanır.* (N-tuple bandit arXiv 1705.01080; otomatik playtest arXiv 1908.01417.)

## Anlatı Tasarımı — 4 Katman, Sıkı Sırada (LLM ile BAŞLAMA)

1. **Kronik olay-otobüsü** (ÖNCE bu): serbest-metin `storyLog`'u tipli olay kaydına çevir `{type, t, actors, place, cause, magnitude, significance}` → append-only "kronik" (save'e). *Dwarf Fortress Legends modeli: hikaye = sorgulanabilir tarih.* Legends paneli. **Düşük risk, %100 deterministik, yeni-AI yok.**
2. **İlişki & itibar simülasyonu**: komutanlar arası ikili `opinion[a][b]`, kronik-olaylarıyla şeffaf gerekçeyle itilir (*CK2 Opinion*: "şehrimi aldın −40", "birlikte kazandık +10"); eşiklerle rakip/müttefik/kan-davası. storyCommanderDecide/firar/darbe'ye yumuşak geri-besleme → ihanet **nedensel ve tekrarlayan**.
3. **Dram-yönetmeni** (tempo): *RimWorld* tarzı hafif — kronik-öneminden gerilim-metresi, zaten-mümkün savaş/darbeleri modüle eder; "storyteller" presetleri (sakin/klasik/kaos). Seed'li (MP-güvenli).
4. **LLM anlatım** (opsiyonel cila): Claude Haiku 4.5 **sadece** deterministik kroniğin üstünde async/offline metin-renderer (asla sim/karar). Batch API ile kampanya-kroniği sent'in altı. Daima-açık fallback = Tracery (saf-JS). Kurallar: lockstep İÇİNDE asla, state'e yazma yok, gerçeklere kısıtlı + isim-doğrula.

## Göç Yol Haritası (8 faz — her biri tek başına oynanabilir)

| Faz | Hedef | Risk |
|-----|-------|------|
| **0** | Vite + tsconfig (allowJs, strict:false) — oyun bundle'dan AYNEN çalışır, henüz .ts yok | Düşük (geri-alınabilir) |
| **1** | Tek-oyuncu muharebeyi sabit-tick akümülatöre taşı + render interpolasyonu ("eğitim==canlı") | Orta (his/tempo değişebilir) |
| **2** | Story.js'i deterministik yap (19 Math.random → seed'li meta-RNG; tek düz-veri ağacı) | Orta (iterasyon-sırası tuzakları) |
| **3** | Sürümlü kaydet/yükle + migrasyon (MP hash'i bütünlük için) | Düşük |
| **4** | İçeriği veriye çıkar + yükleme-anı doğrulayıcı (olay TRIGGER→CONDITION→EFFECT şeması) | Düşük-orta |
| **5** | Render → PixiJS v8 (WebGL); sim'e DOKUNMA | Orta (izole) |
| **6** | Olay-otobüsü + mega-dosya bölme + **Kronik** (anlatı Katman 1) | Orta |
| **7** | İlişki grafiği + dram-yönetmeni + **self-play TUNER** (kapalı-döngü) | Orta-yüksek (fitness tasarımı) |
| **8** | (Opsiyonel) LLM anlatım cilası (Haiku Batch + Tracery fallback) | Düşük (izole) |

## Belirsizlikler (dürüst)

- **Cross-browser float determinizmi:** IEEE 754, `sin/cos/sqrt`'ı motorlar-arası bit-aynı garantilemez (doğrulandı). Aynı-tarayıcı (V8↔V8) güvenli. Senin sim'inde 21+23 trig çağrısı var → cross-browser MP istenirse **lookup-tablo yardımcısı** gerek (fixed-point değil).
- **TS göç süresi:** ~12k satır küçük/orta sınır (haftalar); ama dev tek-dosyalar (AI.js 2347) tahmini yukarı itebilir.
- **SelfPlay↔canlı birebirlik:** kod "evet" diyor, doğru görünüyor; yeni sistemler eklerken bu sözleşmeyi **korumak kritik**.
- **Evrimsel tuning yakınsaması:** kaç bin maç gerektiği önceden bilinmez — küçük pilotla ampirik ölç.
- **Tarayıcı-içi batch self-play sınırları** (sekme-throttle/bellek) ortama bağlı — kendi makinende ölç.
- İkincil kaynaklar (Total War MCTS, CK2/CiF iç-yapı): **yaklaşım kanıtlı**, satır-seviyesi sabitler değil — eşikler ampirik ayar ister.

## Kilit Kaynaklar (gerçek)

- PixiJS v8 Launches — https://pixijs.com/blog/pixi-v8-launches
- Factorio FFF #340 Deep desyncs — https://www.factorio.com/blog/post/fff-340
- Gaffer On Games: Deterministic Lockstep — https://gafferongames.com/post/deterministic_lockstep/
- Gaffer On Games: Fix Your Timestep! — https://gafferongames.com/post/fix_your_timestep/
- Mark & Dill, Utility Theory (GDC 2010) — https://media.gdcvault.com/gdc10/slides/MarkDill_ImprovingAIUtilityTheory.pdf
- MCTS in Total War: Rome II — http://aigamedev.com/open/coverage/mcts-rome-ii/
- N-Tuple Bandit EA (arXiv 1705.01080) — https://arxiv.org/pdf/1705.01080
- Automatic Playtesting (arXiv 1908.01417) — https://arxiv.org/pdf/1908.01417
- OpenAI Five (RL maliyet gerçeği) — https://cdn.openai.com/dota-2.pdf
- DF2014 Legends — https://dwarffortresswiki.org/index.php/DF2014:Legends
- The Surprising Design of CK2 — https://www.gamedeveloper.com/design/the-surprising-design-of-i-crusader-kings-ii-i-
- RimWorld AI Storytellers — https://rimworldwiki.com/wiki/AI_Storytellers
- Tracery (offline anlatım) — https://github.com/galaxykate/tracery
- Claude Pricing (Haiku 4.5 Batch) — https://platform.claude.com/docs/en/about-claude/pricing
