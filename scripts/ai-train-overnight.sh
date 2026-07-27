#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# GECE-BOYU AI EĞİTİMİ — çok-turlu, BİRİKİMLİ DAgger-lig. Her tur:
#   çeşitli-rakip on-policy DAgger (mevcut model sürer) → TÜM birikmiş veriyle retrain → ölç → otomatik-göm.
# Veri turlar boyunca BİRİKİR (DAgger aggregation) → model gerçekten güçlenir.
# Kullanım:  scripts/ai-train-overnight.sh <tur_sayisi> <seed> <baslangic_no>
# ═══════════════════════════════════════════════════════════════════════════
cd "$(dirname "$0")/.."
ROUNDS="${1:-8}"
SEEDS="${2:-6}"
START="${3:-3}"
TICKS="550,700,850,1000,1150"
Q=qa-runtime
EL="env -u ELECTRON_RUN_AS_NODE npx electron ."
LOG="$Q/overnight-log.txt"

# birikmiş temel veri (bu oturumda toplandı) + gece boyu eklenecekler
BASE="$Q/oracle-dataset-big.json,$Q/oracle-dagger.json,$Q/dagger-blue1600.json,$Q/dagger-blue1800.json,$Q/oracle-defender.json"
ACCUM=""                          # gece boyu biriken on-policy dosyalar
MODEL="$Q/selector-model.json"    # başlangıç = kanonik (bugünkü en iyi)

echo "═══ GECE EĞİTİMİ BAŞLADI: $ROUNDS tur × $SEEDS seed ═══" | tee "$LOG"
date | tee -a "$LOG"

for ((r=START; r<START+ROUNDS; r++)); do
  echo "" | tee -a "$LOG"
  echo "########## TUR $r ($(date +%H:%M)) ##########" | tee -a "$LOG"

  # 1) çeşitli-rakip on-policy DAgger (3 rakip: 1400 combat, 1700 combat, 1400 mixed)
  $EL --oracledagger "$MODEL" 12 "$TICKS" 1 "$SEEDS" "$Q/on-r${r}-a.json" 1400 combat 2>&1 | grep -E "DAGGER_YAZILDI|JSHATA" | tee -a "$LOG" || true
  $EL --oracledagger "$MODEL" 12 "$TICKS" 1 "$SEEDS" "$Q/on-r${r}-b.json" 1700 combat 2>&1 | grep -E "DAGGER_YAZILDI|JSHATA" | tee -a "$LOG" || true
  $EL --oracledagger "$MODEL" 12 "$TICKS" 1 "$SEEDS" "$Q/on-r${r}-c.json" 1400 mixed  2>&1 | grep -E "DAGGER_YAZILDI|JSHATA" | tee -a "$LOG" || true
  ACCUM="$ACCUM,$Q/on-r${r}-a.json,$Q/on-r${r}-b.json,$Q/on-r${r}-c.json"

  # 2) TÜM birikmiş veriyle retrain (base + gece boyu her tur)
  NEW="$Q/selector-model-r${r}.json"
  node js/BattleSelector.js "${BASE}${ACCUM}" 400 "$NEW" 2>&1 | grep -E "Birleştir|DEV |MODEL_KAYDEDILDI" | tee -a "$LOG" || true

  # 3) ölç (kod-AI baseline'a karşı, iki rakip gücü)
  for B in 1400 1700; do
    RES=$(SEL_MIN=500 SEL_MAX=999999 BLUE_BUDGET=$B $EL --selectorlive "$NEW" 4 1 2>&1 | grep "SELECTORLIVE_OZET" || true)
    echo "  vs blue-$B: $RES" | tee -a "$LOG"
  done

  # 4) otomatik-göm (yeni model → oyun + kanonik)
  cp "$NEW" "$Q/selector-model.json"
  node -e '
    const m = JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
    const js = "// OTOMATİK (gece tur '"$r"') — lig-eğitimli seçici model.\n"
      + "const BATTLE_SELECTOR_TRAINED_MODEL = " + JSON.stringify(m) + ";\n"
      + "const BATTLE_SELECTOR_AUTO_ENABLE = true;\nconst BATTLE_SELECTOR_AUTO_MIN_TICK = 500;\n"
      + "if (typeof module !== \"undefined\") module.exports = { BATTLE_SELECTOR_TRAINED_MODEL, BATTLE_SELECTOR_AUTO_ENABLE };\n";
    require("fs").writeFileSync("js/BattleSelectorModel.js", js);
  ' "$NEW"
  MODEL="$NEW"
  echo "  → tur $r bitti, model gömüldü ($(date +%H:%M))" | tee -a "$LOG"
done

echo "" | tee -a "$LOG"
echo "═══ GECE EĞİTİMİ BİTTİ ($(date +%H:%M)) — son model: $MODEL ═══" | tee -a "$LOG"
echo "Sabah: git diff js/BattleSelectorModel.js (yeni model gömülü), $LOG (ilerleme)" | tee -a "$LOG"
