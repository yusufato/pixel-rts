# Pixel Europa — Geliştirme Planı (canlı belge)

> Tek doğruluk kaynağı. Fikir değişince BURAYI güncelleriz, savrulmayız.
> Karar (2026-06-27): **Motor değiştirilmeyecek.** Elimizdeki web oyunu en iyi seviyeye çıkarılacak.
> Sıfırdan yazmak (Godot vb.) pahalı + gereksiz → **iptal.** Steam'e ileride sarmalayıcıyla (Tauri/Electron) çıkılır.

## ⚔️ ODAK DEĞİŞİMİ (2026-06-27, kullanıcı): ÖNCE DÜELLOYU BİTİR
Kullanıcı: "düello AI'sini geliştirmek bir sonraki adım; hikaye ve harita zor işler, tam bitiremediğimiz DÜELLO'yu bitirmemiz lazım." → **Yeni öncelik: taktik muharebenin (düello) tamamlanması + düello AI derinliği.** Hikaye/harita/diplomasi ERTELENDİ (AI overworld katmanı şimdilik yeterli).
- **DÜELLO-1: Kaynak simetrisi** ✅ (2026-06-27) — AI artık OYUNCU gibi TİPLİ havuzdan dizer (`DEPLOY_RES.red`): anti-tank=⭐puan, tank=⛽petrol, piyade=👥insan. "İmkânsız sayıda anti-tank" bug'ı bitti (8→1). placeUnit+aiDeploy+budget tipli. QM/MP korundu.
- **DÜELLO-2: Düello AI derinliği** (AKTİF — kullanıcı /goal verdi, internet-araştırma+otonom-geliştirme yetkisi). HEDEF: karmaşık+akıllı ama KENDİSİYLE ÇELİŞMEYEN, "vay be" dedirten savaş AI. Workflow çalıştı: gerçek RTS-AI araştırması (StarCraft botları/Total War/CoH/influence-maps/utility-AI) + mevcut commanderDrive/engageCombat/Foresight çelişki-analizi → tutarlı plan. commanderDrive taktik zekası (formasyon, manevra, focus-fire, kite, arazi, geri-çekilme) + alt-katman tutarlılığı (makro/rol/birim tek utility-çekirdeği).
- **DÜELLO-3: Denge** — birim karşıtlıkları, maliyet/değer, deploy dengesi.

### 🧠 YOL KARARI (2026-06-27): KADEMELİ HİBRİT (kural-AI tavanını öğrenmeyle aş)
Kullanıcı içgörüsü: el-yazısı kural-AI'nin tavanı var; gerçek "düşünme" ÖĞRENEN modelden gelir (parametreleri yazmayız, self-play öğretir). VİZYON: "AI benim gibi haritayı görüp 'nerede ne yapsam' düşünsün."
- **AŞAMA 1 (önce, kontrollü):** influence-map ALGI (saha-okuma) + temiz utility-çekirdeği + KATMAN ÇELİŞKİSİ çözümü. AI'nin "gözü" + tutarlı iskelet. (Çalışan workflow bunu tasarlıyor.)
- **AŞAMA 2 (sonra):** üstüne ÖĞRENEN self-play POLİTİKASI (küçük NN, SelfPlay.js arenası → kural-tavanını aşar, beklenmedik taktik keşfeder). Geçmeden ÖNCE: JS'te küçük-NN + self-play + determinizm grounded fizibilite araştırması (anti-halüsinasyon). influence-map = öğrenen politikanın gözü (boşa değil).

## İlke
1. **Derinlik > genişlik.** Aynı anda 5 sisteme dokunma. TEK sistemi derinlemesine bitir, test et, sonra sıradakine geç.
2. **Plan önce.** Yeni bir işe başlamadan bu belgeye yazılır + önceliklendirilir.
3. **Her adım oynanabilir/test edilebilir** sevk edilir (mevcut oyun hiç bozulmaz).
4. **Motor = altyapı; AI/oyun-mantığı = ayrı.** İstediğimiz derinlik (zeki komutan, hikaye) oyun-mantığı işidir, motor işi değil.

---

## ÖNCELİK 1 — KOMUTAN AI ZEKASI (asıl hedef: Total War: Attila hissi)

**Sorun:** Komutanlar tek-adım açgözlü ("en yakın zayıfa saldır"); çok-adım planlamıyor, koordine olmuyor, cepheyi bütün okumuyor.
**Hedef:** Çok daha zeki, niyetli, koordineli komutanlar. (Attila birebir değil; ondan ilham, ŞU ANKİNDEN kat kat iyi.)

Alt-adımlar (sırayla, her biri test edilir):
- **1.1 Durum-değerlendirme derinliği** ✅ (2026-06-27) — `storyEvalTarget`: değer × kazanma × ileriye-bakış-riski × **konsolidasyon** (çevre dostsa güvenli kazanç, derin salient riskli). Açgözlü tek-adım kaldırıldı.
- **1.2 Çok-adım ileriye-bakış** ✅ (2026-06-27) — `storyExposureAt`: "bu şehri alırsam komşu düşman komutanları beni vurur mu?" → overextension cezası (kişilik `caution` ile ölçekli: agresif riske atılır, savunmacı kaçar). Sim doğrulandı: dengeli komutan güvenli hedefi tuzağa tercih ediyor.
- **1.3 Komutanlar-arası koordinasyon** ✅ (2026-06-27) — `storyStaffPlan` (devlet "genelkurmay"ı, 5sn'de bir): tehdit altındaki şehirlere açığı kapatacak kadar komutan (savunma boyutlu) → sonra değerli düşman hedeflerine YETERLİ güç → sonra SIRADAKİ hedefe (yığılma yok). Alınamayan hedefe komutan harcanmaz. `storyExecuteObjective` emri uygular (kuşat/savun/ilerle), geçersizse bireysel-fallback. Sim doğrulandı: 4 komutan → savunma + 2 ayrı hedefe yayıldı.
- **1.4 Strateji postürü / ekonomi-farkındalık** ✅ (2026-06-27) — devlet ekonomisi + cephe yükü → konsolide / dengeli / genişle. Tükenmiş/yayılmış devlet saldırıyı kısar (intihari overextension yok, dünya nefes alır). Sim doğrulandı.
- **1.5 Komutan yetenekleri ANLAMLI** ✅ (2026-06-27) — warrior=güç (vardı), ekonomist=DAHA BÜYÜK gelir payı (lojistik, toplam korunur), diplomat=sadakat istikrarı (firar/darbe direnci + diplomasiye zemin). Komutanlar gerçek birey.
- **1.6 Self-play tuning** (opsiyonel/sonra) — headless maçlarla kişilik/utility ağırlıklarını otomatik ayarla (evrimsel); OP-strateji otomatik yakalansın. "Daha az el-ayarı."

> Not: Bunlar mevcut Story.js/Commander.js/Foresight.js üzerine **kademeli** eklenir; yeniden-yazım yok.

## ÖNCELİK 1.5 — DİPLOMASİ (kullanıcı notu: gelecek; AI'leri "rahatlatacak")
Şu an herkes herkesle savaşıyor → AI'ler sürekli baskı altında. Diplomasi gelince: ittifak/barış/ateşkes, savaş ilanı, rekabet/güven, ortak düşman. Bu hem AI'yi rahatlatır (her cephede savaşmaz) hem **emergent hikayeyi** besler (ihanet, ittifak bozma). Strateji postürü (1.4) ile birleşir: barıştaki komşuya saldırmaz. **Şimdi değil — AI çekirdeği oturduktan sonra.**

## ÖNCELİK 2 — TAKTİK MUHAREBE DERİNLİĞİ
Formasyon, arazi kullanımı, birim-rolleri/karşıtlıkları, moral/bozgun, kontrol-noktası taktiği. (Kısmen var; derinleştir.)

## ÖNCELİK 3 — HARİTA & COĞRAFYA
Üzerinde çalışılıyor. Cephe/komşuluk/darboğaz mantığı AI ile uyumlu olsun.

## ÖNCELİK 4 — EKONOMİ & DEVLET YÖNETİMİ
Kaynak/şehir/tech/garnizon dengesi; oyuncu kararlarının anlamlı olması.

## ÖNCELİK 5 — EMERGENT HİKAYE (Kronik)
storyLog'u tipli olay-kroniğine çevir + komutan ilişki/kin grafiği → "devletler birbirini yok etmiyor, hikaye üretiyor". (Araştırmada düşük-risk/yüksek-getiri çıktı.)

## ÖNCELİK 6 — CİLA
UI, ses, görsel his, performans. (En son.)

---

## Çalışma kaydı
- 2026-06-27: Plan kuruldu. Godot/yeniden-yazım iptal. İlk derin-iş: **Öncelik 1 — Komutan AI zekası.**
- 2026-06-27: **AI 1.1 + 1.2 bitti** — komutanlar ileriye-bakışlı + konsolidasyon-farkında + kişilik-temkinli karar veriyor.
- 2026-06-27: **AI 1.3 bitti** — devlet "genelkurmay"ı komutanları koordine ediyor (savunma boyutlu + saldırı yayılmış, tek şehire yığılma YOK).
- 2026-06-27: **AI 1.4 bitti** — strateji postürü (konsolide/genişle).
- 2026-06-27: **SAVUNMA + DENGE DÜZELTMELERİ** (kullanıcı: "düşman koordineli toprak alıyor, komutanlar oturuyor, boş şehre saldırınca devasa ordu, sürekli yeniliyoruz"). 6 fix:
  - Savunma yetişmesi: SIEGE_TIME 14→18, STAFF_REPLAN 5→3, acil-savunan 2s tekrar.
  - (A) ZIPLAMA YOK: tek-adım hareket (hız sık-kararla, 3-hop yürüyüş geri alındı — kullanıcı isteği).
  - (B) SAVUNMA YAYMA: PASS1 her kuşatılana 1 savunan + PASS2 derinleştir (5 şehir kuşatılırken 2'ye yığılma yok).
  - (C) KOMUTAN ÖLÜMÜ: kaybeden %45 ölür (jeton hariç), AI-vs-AI + player-düello + soyut-kuşatma; `storyKillCommander`. Tükenmesin diye `storyReplenishCommanders` (yavaş/tavanlı/refah-kapılı).
  - (D) ORANTILI SAVUNMA BÜTÇESİ: `storyEnemyForceBudget` yeniden — boş şehir 1050→250, bitişik komutan 0.5×, garnizon dahil ("devasa ordu" bug'ı gitti).
  - **SIRADAKİ: test + adım adım devam (1.5+).**
- 2026-06-27: **BUG FIX + SİMETRİ** (kullanıcı: "düello sonrası script error" + "düşman şehri 250 milisle savunuyor, bizimkinde milis yok"). (1) storyOnBattleEnd satır 628 `inv` blok-kapsamlıydı → ReferenceError, ctx'ten direkt çözüldü. (2) CITY_MILITIA_BASE=3 (şehir taban milisi).
- 2026-06-27: **MİLİS-SALDIRI BUG + YETENEKLER (1.5).** (1) Kullanıcı: "düşman milis birliği saldırıyor, sadece komutanlar saldırmalı." Kök: storyLaunchDefense düşman SALDIRISINDA storyEnemyForceBudget (milis 250 + oyuncunun garnizonu!) kullanıyordu. Fix: `storyAttackerForceBudget` (SADECE komutan kuvveti, milis/garnizon yok). İlke: attacker=komutan-only, defender=komutan+milis+garnizon. (2) **1.5 yetenekler anlamlı:** ekonomist→gelir payı, diplomat→sadakat istikrarı. Sim+brace OK. **SIRADAKİ: test + adım adım (1.6+ / Öncelik 2 / Diplomasi / Kronik).**
