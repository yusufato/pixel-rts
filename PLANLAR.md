# PLANLAR — Ertelenen / Sonradan Dönülecek İşler

> Bu dosya, ana plandan ([SAVAS-AI-PLAN-v4-LLM.md](SAVAS-AI-PLAN-v4-LLM.md)) çıkan ama şimdilik
> ertelenen seçenekleri tutar. **Kural: FAZ 1'e geçmeden önce buradaki açık maddeler halledilir.**

---

## A) Oyuncu-girdi deterministik kuyruğu — canlı-oyuncu maçlarını bit-birebir replay edilebilir yap

**Durum:** ✅ TAMAMEN KAPANDI. İki AYRI kök neden vardı, ikisi de çözüldü:
1. **Async oyuncu-girdi** (0/1b, commit `fbd9e93`): fare olayı `u.targetX`'i tik-sınırı DIŞINDA set
   ediyordu → `pendingPlayerCommands` kuyruğu ile tik-sınırına taşındı. `--liverepro` sıfır sapma.
2. **initialState pozisyon-precision kaybı** (commit `48653cd`): `battleUnitSnapshot` x/y/hp'yi 2 ondalığa
   YUVARLIYORDU (`Math.round(x*100)/100`) ama targetX/targetY'yi tam bırakıyordu. Canlı sim tam-precision
   pozisyondan çalışır; capture yuvarlar; replay yuvarlanmıştan başlar → sub-0.01 hata her tik birikip
   tick 20'de hash-yuvarlama sınırını geçer. Tick-0 hash eşleşiyordu (hash de round(*100) yapıyor) → gizli kaldı.

**Nasıl bulundu (teşhis zinciri):**
- `battleMaybeRecordHash` yalnız `tick%20==0`'da kaydediyor → "tick 20'de sapıyor" = ilk checkpoint, sapma daha erken.
- `--replaycheck` alan-karşılaştırma TOLERANSLARI (0.5) hash-duyarlılığından (0.01) gevşekti → sapmayı gizliyordu.
  Hash-birebir (`round(*100)` tam-sayı) karşılaştırmaya çevrildi → TEK birim çıktı: id14 mavi, x 1358.58 vs 1358.5866.
- `--precisiontest`: u14 başlangıç x'ini `-0.005` nudge'lamak tick-20 hash'i kayıtlı `dcb24eaf`'e birebir döndürdü
  → sapma KESİN olarak pozisyon-precision kaybı.
- `--fixverify`: kesirli pozisyon enjekte → capture 22 birimde >2 ondalık korudu → 380 tik canlı → replay SIFIR sapma.

**Neden gizli kaldı:** `verifyBattleReplayDeterminism` replay'i İKİ kez aynı (yuvarlanmış) initialState'ten koşup
karşılaştırıyor — canlı-vs-replay DEĞİL. Self-play/fork de aynı yuvarlanmış durumdan iki kez → hep eşleşiyordu.
**Not:** Eğitim hattı zaten bundan etkilenmiyordu (self-play iki-replay tutarlıydı); fix, canlı-oyuncu byte-replay'i
("AI senin maçlarını bayt-bayt izlesin") artık gerçekten mümkün kılıyor.
**Teşhis araçları (electron, dev):** `--replaycheck` (hash-birebir alan farkı), `--precisiontest`, `--fixverify`.

**Bağlam / kök neden (Faz 0'da bulundu):**
- Ölçüldü: **self-play / AI-vs-AI determinizmi SAĞLAM** (savaş, ölüm, fleeing dahil sıfır sapma).
  Karşı-olgusal rollout + lig self-play headless AI-vs-AI olduğundan **eğitim hattı bundan etkilenmez.**
- **Canlı-OYUNCU kayıtları** replay'de ~4-5 sn'de sapıyor. Kök neden: **oyuncu komutları fare olay-
  işleyicisinden ASENKRON uygulanıyor** (tık anında `u.targetX` set edilip o anki `SIM.tick` damgalanıyor) —
  tik sınırında DEĞİL. Replay ise onları `stepSim` başında (`battleReplayDrive`) uyguluyor. Tık, o tik'in
  stepSim'inden sonra geldiyse → canlı 1 tik geç, replay 1 tik erken → hedef/pozisyon sapar.
- Oyuncu komutları, tik-sınırında uygulanmayan **tek** mutasyon → bu yüzden AI-vs-AI temiz, oyuncu oyunu sapıyor.

**Neden şimdilik ertelenebilir:** Planda oyuncu kayıtları **byte-replay** olarak değil, **emir/telemetri**
olarak kullanılıyor (LLM koç telemetriden okur; lig, insan komut-çizgisini emir olarak kullanır). Byte-exact
oyuncu-replay yalnız "AI senin maçlarını bayt-bayt izlesin" hedefi için gerekir — eğitim için değil.

**Yapılacak fix:** Oyuncu komutlarını (fare işleyicisi) doğrudan uygulamak yerine bir **pending kuyruğa** al;
`stepSim` başında (replay'in `battleReplayDrive` ile aynı noktada) sırayla uygula + `battleRecordEvent` orada
çağrılsın. Böylece canlı ve replay uygulama noktası birebir aynı olur.
- **Dokunulacak yerler:** `js/main.js` fare işleyicileri (player-move / player-attack), `stepSim` başı,
  yeni `pendingPlayerCommands` globali; ayrıca `js/WarRoomUI.js` (player-move / player-free-fire) ve MP yolu.
- **Davranış etkisi:** ≤50 ms girdi gecikmesi (bir tik) — algılanamaz.
- **Doğrulama:** Fix'li build'den **TAZE bir kayıt** gerekir (mevcut kayıtlar eski asenkron yolla üretildi,
  onlarla test EDİLEMEZ). `electron . --replaycheck <yeni-json>` → `divergence: null` beklenir.

**İlgili tamamlanmış iş:** `player-move` replay'inde çift `terrainSafePoint` (idempotent değil) latent bug'ı
düzeltildi → commit `938eac2`. (Gözlenen kayıtlarda etkisizdi çünkü hedefler geçilebilir arazideydi.)

**Teşhis araçları (electron):** `--liverepro` (canlı yolu taklit edip replay sapmasını izole eder),
`--replaycheck <json>` (ham kaydı replay edip hash sapmasını + alan farkını raporlar).
