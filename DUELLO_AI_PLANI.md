# Düello AI — Derin Geliştirme Planı (AŞAMA 1: tutarlı kural temeli)

> Kaynak-temelli araştırma (6 ajan, GERÇEK kodda doğrulandı) + kullanıcı /goal.
> Hedef: karmaşık + akıllı ama **kendisiyle çelişmeyen**, "vay be" dedirten düello AI.
> AŞAMA 2 (sonra): üstüne öğrenen self-play politikası (önce fizibilite araştırması).

## 🔴 Kök sorun: KENDİSİYLE ÇELİŞME (hepsi kodda kanıtlandı)

Canlı AI = `commanderDrive` (Commander.js, AI_BACKEND='policy'). Zincir: gözlem → makro mod → rol → `cmdrOrderUnit` → `engageCombat`. Ama:

1. **KATMAN SAHİPLİĞİ ÇATIŞMASI (asıl bug):** `engageCombat` HER tick (main.js:946) hedef+hareketi yeniden seçer; `cmdrOrderUnit` yalnız 1400ms'de yazar → **gerçek karar verici BİRİM, komutan değil.** Komutan "REGROUP/çekil" der, birim menzilde düşman görünce durup ateş eder → ordu temiz çekilemez. **İki katman birbiriyle döğüşüyor.**
2. **FORESIGHT ÖLÜ:** LookaheadAdvisor (Foresight.js) yalnız LayeredAI'de (varsayılan-dışı) çağrılır; canlı komutan+SelfPlay ona hiç dokunmaz. WITHDRAW/HOLD/SIEGE postürü + birim-vetosu canlıda yok.
3. **ROL KOPUK:** komutan `u.cmdrRole` (MAIN/PIN/FLANK/RESERVE) yazar; kite `getSquadRole` (VANGUARD/FLANK/SUPPORT) okur, `u.squad` canlıda hiç set edilmez → PIN birim yanlış kite eder.
4. **ÜÇ HİSTEREZİ SAATİ** (decisionMs/COMMIT_HOLD_MS/commitK) çelişebilir → postür titrer.
5. **KOORDİNELİ ODAK ATEŞ İNERT:** `aiFocusTarget` canlıda NULL → her birim kendi hedefini seçer, hasar yayılır (RL/SC mikrosunda en büyük verim kaldıracı kaybı).

## 🟢 Temel çözüm: TEK DOĞRULUK KAYNAĞI
Komutan tek `u.intent = {role, anchorX, anchorY, posture, leashR, allowAdvance, preferredRange, focusTarget}` yazar. `engageCombat` saf **İCRACI** olur (hangi düşmana ateş seçer AMA posture/leash dışına çıkamaz). Foresight TEK danışman olarak bağlanır (paralel ikinci decider YOK). Eklenen ağırlıklar **gen** olur → SelfPlay evirir. Deterministik korunur; ally (commanderDriveAlly) + Quick Match/MP bozulmaz (aynı çekirdek).

## Yol haritası (her adım: test + brace + sim; izolasyon korunur)
1. **TEK NİYET KANALI** ⭐İLK — `cmdrOrderUnit` u.intent yazsın; engageCombat AI dalı saf icracı (hareket=anchor'a clamp(leashR), REGROUP/HOLD'da ilerleme yok). [çelişme-kökü]
2. **DISENGAGE** aiAction — REGROUP/WITHDRAW'da birim menzilde düşman olsa bile durup-ateş etmez, düzenli çekilir.
3. **ROL BİRLEŞTİR** — kite preferredRange'i cmdrRole'den (PIN/topçu→geniş, FLANK→orta, MAIN→yakın).
4. **FORESIGHT'I BAĞLA** — commanderDrive'a TEK danışman: posture(COMMIT/HOLD/SIEGE/WITHDRAW)+Schwerpunkt+manevra. [ölü-kodu canlandır]
5. **HİSTEREZİ BİRLEŞTİR** — tek kadans + asimetrik Schmitt gir/çık (postür titremesin); opsiyonel IAUS utility-oylama.
6. **KOORDİNELİ ODAK ATEŞ** — komutan grup-başına 1-2 kill-target (topçu/AT önce) + overkill-ledger.
7. **COUNTER-FARKINDA HEDEF** — Tanksavar→Tank ×4 skora kat; zırh AT'tan kaçar.
8. **AKILLI KİTE** — cooldown-senkron stutter-step + yaralı pahalı birim (timeToDie<timeToKill) çekilir.
9. **(Faz-2) PAYLAŞILAN ETKİ-HARİTASI** — ~24x16 grid, komutan+birim AYNI alanı okur (influence-map "saha-okuma" = öğrenen politikanın gözü). Anti-clumping.

## Gerçek kaynaklar (doğrulanmış)
- Dave Mark — Modular Tactical Influence Maps (Game AI Pro 2): https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter30_Modular_Tactical_Influence_Maps.pdf
- Mark & Dill — Utility Theory / IAUS (GDC 2010): https://media.gdcvault.com/gdc10/slides/MarkDill_ImprovingAIUtilityTheory.pdf
- Tommy Thompson — The AI of Total War (Part 5): https://www.gamedeveloper.com/design/war-hammer-the-ai-of-total-war-part-5-
- Lanchester combat prediction in StarCraft (AAAI): https://cdn.aaai.org/ojs/12780/12780-52-16297-1-2-20201228.pdf
- StarCraft Micro with RL (arXiv 1804.00810): https://arxiv.org/pdf/1804.00810
- Separate independent unit control / overkill-ledger (Jay Scott): http://satirist.org/ai/starcraft/blog/archives/417-separate,-independent-unit-control-for-micro.html
- Stutter Step (SC2 Liquipedia): https://liquipedia.net/starcraft2/Stutter_Step
- Believable Tactics for Squad AI (GDC): https://www.gdcvault.com/play/1015665/Believable-Tactics-for-Squad
- Defeat in detail (Schwerpunkt): https://en.wikipedia.org/wiki/Defeat_in_detail

## Çalışma kaydı
- 2026-06-27: Araştırma+analiz+sentez workflow (wsq38id41, 6 ajan) tamamlandı, planlar kodda doğrulandı.
- 2026-06-27: **ADIM 3 + ADIM 4 bitti.** Adım 3: kite preferredRange komutan rolünden (u.intent) → PIN/topçu geniş standoff, FLANK orta, MAIN yakın (rol-taksonomi kopukluğu çözüldü). **Adım 4: FORESIGHT CANLANDIRILDI** — COMMANDER.advisor (taraf başına LookaheadAdvisor), commanderDrive+Ally decisionMs'de advisor.decide çağırır, cmdrDecide'a GİRDİ (paralel decider DEĞİL): WITHDRAW→çekil (intihar-charge önle), adv.target→Schwerpunkt (kuvvet yoğunlaştır). Geriye-uyumlu (adv yoksa eski). Deterministik (Foresight Math.random kullanmaz), MP-güvenli. **Adım 5/6/7/8 BİTTİ (2026-06-27):** Adım 5 = cmdrDecide SCHMITT histerezi (kesin üstün→ATTACK, kesin zayıf→REGROUP, bant-içi önceki-modu-koru → postür titremez). Adım 6 = KOORDİNELİ ODAK ATEŞ (komutan en "sulu" düşmanı [değer/can × kırılgan] kill-target seçer, u.intent.focusTarget, findBestVisibleEnemy +8000 yoğunlaşır, overkill-cap=hp/70 → tek hedefe yığılmaz). Adım 7 = ZATEN HAZIR (TargetScoring ttk→calculateUnitDamage ×4 zırh-delme + armorBonus counter-farkında; redundant terim eklemedim, çift-sayım riski). Adım 8 = AKILLI KİTE (yalnız menzil≥hedef×0.95 + hız≥hedef×0.85 iken kite → yavaş/kısa-menzilli yakalanıp DPS kaybetmez). brace OK, oyuncu/ally/QM-MP izole, deterministik (Math.random yok).

**KALAN: Adım 9 = INFLUENCE-MAP (paylaşılan saha-okuma) — bilinçli ERTELENDİ.** Sebep: (1) en riskli adım (float-grid MP cross-platform sapma → desync; quantize şart). (2) sentez "önce 1-8 doğrulansın" dedi. (3) MİMARİ: influence-map zaten AŞAMA-2 ÖĞRENEN BEYNİN "gözü"/girdi-temsili olacak → onu Stage-2 ile BİRLİKTE kurmak tutarlı (rule-AI için kurup sonra yeniden-uyarlamak redundant). Yani Aşama-1 taktik-AI çekirdeği (1-8) TAMAM; Adım 9 = Stage-1↔Stage-2 köprüsü, öğrenen beyinle gelir.

> **MİMARİ VİZYON (2026-06-27, kullanıcı): İKİ BEYİN, PAYLAŞILAN POLİTİKA.** (1) DÜELLO-BEYNİ: düello-içi eğitilmiş, savaştaki birimleri sürer (şu an üzerinde çalıştığımız). (2) KOMUTAN-BEYNİ: TEK paylaşılan beyin, 8 ülke/80 komutanın HEPSİ ayrı ayrı çalıştırır — her biri kendi girdisiyle (kişilik/durum/kaynak) FARKLI davranır. Analoji: "ben Claude'u kullanıyorum ama o aynı anda yüzlerce kişiye hizmet ediyor; birbirimizi görmüyoruz." = ML'de PARAMETRE PAYLAŞIMI (multi-agent: tek ağırlık seti, N ajan, N bağlam). 80 ayrı beyin DEĞİL → 1 beyin, 80 bağlam. Tek beyin eğit/iyileştir → hepsi faydalanır. Bu AŞAMA-2 mimarisi; AŞAMA-1 (şu anki tutarlı kural/niyet temeli) = beynin oturacağı SUBSTRAT.

- 2026-06-27: **ADIM 1 başladı — TEK NİYET KANALI kuruldu.** `cmdrOrderUnit` artık `u.intent={posture}` yazar (REGROUP→DISENGAGE / TERRITORY→HOLD / diğer→ATTACK). `engageCombat` AI dalı DISENGAGE'i okur: çekilmede DUR-VUR yapmaz, komutanın toplanma noktasına gider + yolda ateş eder → **REGROUP çelişkisi (ordu çekilemiyordu) YAPISAL çözüldü.** brace OK, oyuncu dalı/ally/QM-MP izole. KALAN (Adım 1 tamamı): u.intent'e anchor/leashR/allowAdvance ekle + engageCombat hareketi leash'e clamp (birim komutan pozisyonu dışına çıkamasın). SONRA: Adım 3 rol-birleştir → Adım 4 Foresight-bağla → ...
