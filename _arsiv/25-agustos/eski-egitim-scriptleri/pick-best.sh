#!/usr/bin/env bash
# Gece modellerinden GERÇEK en iyiyi seç (6 seed × 2 rakip, gürültü azalt) → en iyiyi göm.
cd "$(dirname "$0")/.."
Q=qa-runtime
EL="env -u ELECTRON_RUN_AS_NODE npx electron ."
LOG="$Q/tournament-log.txt"
: > "$LOG"
BEST=""; BESTSUM=-999999
for M in selector-model-v4 selector-model-r5 selector-model-r7 selector-model-r9 selector-model-r10; do
  F="$Q/$M.json"; [ -f "$F" ] || continue
  SUM=0
  for B in 1400 1700; do
    OUT=$(SEL_MIN=500 SEL_MAX=999999 BLUE_BUDGET=$B $EL --selectorlive "$F" 6 1 2>&1 | grep "SELECTORLIVE_OZET")
    D=$(echo "$OUT" | grep -o '"ortDelta":[-0-9]*' | grep -o '[-0-9]*$')
    [ -z "$D" ] && D=0
    SUM=$((SUM + D))
    echo "$M vs$B: Δ=$D" | tee -a "$LOG"
  done
  echo "$M TOPLAM=$SUM" | tee -a "$LOG"
  if [ "$SUM" -gt "$BESTSUM" ]; then BESTSUM=$SUM; BEST="$M"; fi
done
echo "═══ EN İYİ: $BEST (toplam Δ=$BESTSUM) ═══" | tee -a "$LOG"
# en iyiyi göm
if [ -n "$BEST" ]; then
  cp "$Q/$BEST.json" "$Q/selector-model.json"
  node -e '
    const m = JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
    const js = "// OTOMATİK (turnuva en-iyi: '"$BEST"') — lig-eğitimli seçici model.\n"
      + "const BATTLE_SELECTOR_TRAINED_MODEL = " + JSON.stringify(m) + ";\n"
      + "const BATTLE_SELECTOR_AUTO_ENABLE = true;\nconst BATTLE_SELECTOR_AUTO_MIN_TICK = 500;\n"
      + "if (typeof module !== \"undefined\") module.exports = { BATTLE_SELECTOR_TRAINED_MODEL, BATTLE_SELECTOR_AUTO_ENABLE };\n";
    require("fs").writeFileSync("js/BattleSelectorModel.js", js);
    console.log("GÖMÜLDÜ: "+process.argv[1]);
  ' "$Q/$BEST.json" | tee -a "$LOG"
fi
