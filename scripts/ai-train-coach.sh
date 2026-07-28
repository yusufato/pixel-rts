#!/usr/bin/env bash
# ═══ KOÇ-GÜDÜMLÜ EĞİTİM (Faz 7+8) — Coder-14B her tur metrikleri analiz edip sıradaki deneyi önerir ═══
# Akış: koça danış (zayıf nokta?) → önerdiği rakibe/faza DAgger → warm-start retrain → ölç → metrikleri güncelle.
# Kullanım: scripts/ai-train-coach.sh <tur> <seed>
cd "$(dirname "$0")/.."
ROUNDS="${1:-3}"; SEEDS="${2:-4}"
Q=qa-runtime; EL="env -u ELECTRON_RUN_AS_NODE npx electron ."
LOG="$Q/coach-train-log.txt"; : > "$LOG"
BASE="$Q/oracle-dataset-big.json,$Q/oracle-dagger.json,$Q/dagger-blue1600.json,$Q/dagger-blue1800.json,$Q/oracle-defender.json"
MODEL="$Q/selector-model.json"
# başlangıç metrikleri (bugünkü turnuva sonuçları)
echo '{"rounds":[{"round":"v4","devRegret":25,"opponents":[{"budget":1400,"delta":326},{"budget":1700,"delta":861},{"budget":1600,"delta":-324}]}]}' > "$Q/coach-metrics.json"

for r in $(seq 1 "$ROUNDS"); do
  echo "########## KOÇ-TUR $r ##########" | tee -a "$LOG"
  # 1) KOÇA DANIŞ (Coder-14B metrikleri analiz → deney önerisi)
  echo "  Koç düşünüyor (Coder-14B, ~2 dk)..." | tee -a "$LOG"
  CO=$($EL --coach "$Q/coach-metrics.json" cpu 2>&1 | grep -E "COACH_ONERI|COACH_TUR_PARAM")
  echo "  $CO" | tee -a "$LOG"
  BUDGET=$(echo "$CO" | grep -o '"budgets":\[[0-9]*' | grep -o '[0-9]*$'); [ -z "$BUDGET" ] && BUDGET=1600
  TICKS=$(echo "$CO"  | grep -o '"ticks":"[0-9,]*"' | grep -o '[0-9][0-9,]*'); [ -z "$TICKS" ] && TICKS="550,700,850,1000,1150"
  echo "  → Koç: rakip=$BUDGET, tikler=$TICKS" | tee -a "$LOG"

  # 2) koçun önerdiği rakibe/faza on-policy DAgger
  $EL --oracledagger "$MODEL" 12 "$TICKS" 1 "$SEEDS" "$Q/coach-r$r.json" "$BUDGET" combat 2>&1 | grep -E "DAGGER_YAZILDI|JSHATA" | tee -a "$LOG"

  # 3) warm-start retrain (v4-gücünü koru + koçun hedeflediği veriyi kat)
  NEW="$Q/selector-model-coach$r.json"
  node js/BattleSelector.js "${BASE},$Q/coach-r$r.json" 300 "$NEW" "$MODEL" 2>&1 | grep -E "DEV |MODEL_KAYDEDILDI" | tee -a "$LOG"

  # 4) ölç (koçun hedeflediği rakibe karşı — iyileşti mi)
  RES=$(SEL_MIN=500 SEL_MAX=999999 BLUE_BUDGET="$BUDGET" $EL --selectorlive "$NEW" 4 1 2>&1 | grep SELECTORLIVE_OZET)
  DELTA=$(echo "$RES" | grep -o '"ortDelta":[-0-9]*' | grep -o '[-0-9]*$'); [ -z "$DELTA" ] && DELTA=0
  echo "  Sonuç vs$BUDGET: Δ=$DELTA" | tee -a "$LOG"

  # 5) metrikleri güncelle → sonraki koç turu bunu görür
  echo "{\"rounds\":[{\"round\":\"$r\",\"devRegret\":\"?\",\"opponents\":[{\"budget\":$BUDGET,\"delta\":$DELTA}]}]}" > "$Q/coach-metrics.json"
  MODEL="$NEW"
done
echo "═══ KOÇ-GÜDÜMLÜ EĞİTİM BİTTİ — son model: $MODEL ═══" | tee -a "$LOG"
