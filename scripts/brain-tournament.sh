#!/usr/bin/env bash
# ═══ BEYIN-TURNUVA — b1 (senin-adapte) vs v4 vs r1 → ŞAMPİYON = yeni beyin (oyuna gömülür) ═══
# 3 eksen ölçülür:
#   [İNSAN-GİBİ] (ASIL): insan-taktiği (konsantre+odaklı-ateş) oynayan vekili, kod-AI'dan ne kadar iyi yener → money-metrik
#   [GENEL]           : kod-AI'yı ne kadar yener (genel güç)
#   [SANA]            : senin 30 gerçek durumunda oracle-en-iyiye uzaklık (regret, DÜŞÜK=iyi; b1'de hafif train=test)
# Şampiyon = İNSAN-GİBİ en yüksek (çünkü asıl rakip SENSİN, kod-AI değil). Otomatik oyuna gömülür.
cd "$(dirname "$0")/.."
Q=qa-runtime; EL="env -u ELECTRON_RUN_AS_NODE npx electron ."
LOG="$Q/brain-tournament-log.txt"; : > "$LOG"
NAMES=(b1 v4 r1)
declare -A FILE=( [b1]="$Q/selector-model-human.json" [v4]="$Q/selector-model-v4.json" [r1]="$Q/selector-model-r1.json" )
declare -A DESC=( [b1]="senin maçlarından adapte" [v4]="lig self-play şampiyonu" [r1]="insan-taktiği vekile karşı eğitilen" )
BESTNAME=""; BESTSCORE=-999999; BESTFILE=""
say(){ echo "$1" | tee -a "$LOG"; }
sel(){ echo "$1" | grep -o '"ortDelta":[-0-9]*' | grep -o '[-0-9]*$'; }
say "═══════════ BEYİN TURNUVASI ═══════════"
for name in "${NAMES[@]}"; do
  M="${FILE[$name]}"
  if [ ! -f "$M" ]; then say "  $name (${DESC[$name]}): dosya YOK — atlanıyor ($(basename "$M"))"; continue; fi
  say "─── $name — ${DESC[$name]} ───"
  # 1) İNSAN-GİBİ (ASIL): insan-taktiği vekile karşı, kod-AI'dan ne kadar iyi
  HT=0; HN=0
  for B in 1400 1600; do
    D=$(sel "$(SURROGATE=1 SEL_MIN=500 SEL_MAX=999999 BLUE_BUDGET=$B $EL --selectorlive "$M" 4 1 2>&1 | grep SELECTORLIVE_OZET)"); [ -z "$D" ] && D=0
    HT=$((HT+D)); HN=$((HN+1)); say "    [İNSAN-GİBİ] vekil vs$B: Δ=$D"
  done
  HAVG=$((HT/HN))
  # 2) GENEL: kod-AI'ya karşı
  D=$(sel "$(SEL_MIN=500 SEL_MAX=999999 BLUE_BUDGET=1500 $EL --selectorlive "$M" 4 1 2>&1 | grep SELECTORLIVE_OZET)"); [ -z "$D" ] && D=0
  GAVG=$D
  # 3) SANA: senin 30 durumunda regret
  REG=$(node js/BattleSelector.js --eval "$M" "$Q/human-data.json" 2>&1 | grep EVAL_SONUC | grep -o '"modelRegret":[-0-9.]*' | grep -o '[-0-9.]*$'); [ -z "$REG" ] && REG="?"
  say "  → $name:  İNSAN-GİBİ ortΔ=$HAVG  |  GENEL ortΔ=$GAVG  |  SANA regret=$REG"
  if [ "$HAVG" -gt "$BESTSCORE" ]; then BESTSCORE=$HAVG; BESTNAME=$name; BESTFILE=$M; fi
done
say ""
say "🏆 ŞAMPİYON (insan-gibiyi en iyi yenen): $BESTNAME  (İNSAN-GİBİ ortΔ=$BESTSCORE)"
if [ -n "$BESTFILE" ]; then
  cp "$BESTFILE" "$Q/selector-model.json"
  BN="$BESTNAME" node -e '
    const m = JSON.parse(require("fs").readFileSync("qa-runtime/selector-model.json","utf8"));
    const js = "// OTOMATİK (turnuva şampiyonu: " + process.env.BN + ") — insan-gibi rakibi en iyi yenen beyin.\n"
      + "const BATTLE_SELECTOR_TRAINED_MODEL = " + JSON.stringify(m) + ";\n"
      + "const BATTLE_SELECTOR_AUTO_ENABLE = true;\nconst BATTLE_SELECTOR_AUTO_MIN_TICK = 500;\n"
      + "if (typeof module !== \"undefined\") module.exports = { BATTLE_SELECTOR_TRAINED_MODEL, BATTLE_SELECTOR_AUTO_ENABLE };\n";
    require("fs").writeFileSync("js/BattleSelectorModel.js", js);
  '
  say "GÖMÜLDÜ: $BESTNAME artık oyundaki beyin. Yeni Hızlı Maç aç, dene."
fi
say "Sonraki nesil: 3 yeni beyin farklı yollardan (r2/r3/r4) → tekrar turnuva."
