#!/usr/bin/env bash
# ═══ RECONCILE RETRAIN (Faz 1-4 sonrası) — mevcut motorla TAZE veri üret → warm-start retrain ═══
# Faz 2 (estimatedStrength cost-ağırlıklı OPG) + Faz 4 (focus-skor) modelin gördüğü özellik+ödül dağılımını
# değiştirdi. Eski veri (eski-OPG, sayı-bazlı) artık uyumsuz → SADECE mevcut motorla üretilen taze veri +
# warm-start fusion4 (genel yetkinliği koru). Çıktı: reconciled model → oyuna göm. ~20-30 dk.
cd "$(dirname "$0")/.."
Q=qa-runtime; EL="env -u ELECTRON_RUN_AS_NODE npx electron ."
LOG="$Q/reconcile-log.txt"; : > "$LOG"
echo "═══ RECONCILE: taze veri (Faz 1-4 aktif motor) ═══" | tee -a "$LOG"
DATA=""
# SALDIRAN vs savunan-vekil (usta insan savunması)
for B in 1400 1700; do
  echo "--- saldıran vs$B ---" | tee -a "$LOG"
  SURROGATE=1 $EL --oracledagger "$Q/selector-model-fusion4.json" 10 "600,800,1000,1200,1400" 1 6 "$Q/rec-atk-$B.json" "$B" combat 2>&1 | grep -E "DAGGER_YAZILDI|on-policy örnek" | tail -2 | tee -a "$LOG"
  [ -f "$Q/rec-atk-$B.json" ] && DATA="${DATA:+$DATA,}$Q/rec-atk-$B.json"
done
# SAVUNAN vs saldıran-vekil
for B in 1500 1700; do
  echo "--- savunan vs$B ---" | tee -a "$LOG"
  SURROGATE=1 $EL --oracledagger "$Q/selector-model-fusion4.json" 10 "550,750,950,1150,1350" 0 6 "$Q/rec-def-$B.json" "$B" combat 2>&1 | grep -E "DAGGER_YAZILDI|on-policy örnek" | tail -2 | tee -a "$LOG"
  [ -f "$Q/rec-def-$B.json" ] && DATA="${DATA:+$DATA,}$Q/rec-def-$B.json"
done
echo "═══ RETRAIN (warm=fusion4, yalnız taze uyumlu veri) ═══" | tee -a "$LOG"
node js/BattleSelector.js "$DATA" 320 "$Q/selector-model-reconciled.json" "$Q/selector-model-fusion4.json" 2>&1 | grep -E "Birleştir|Warm-start|DEV |MODEL_KAYDEDILDI" | tee -a "$LOG"
cp "$Q/selector-model-reconciled.json" "$Q/selector-model.json"
node -e '
  const m = JSON.parse(require("fs").readFileSync("qa-runtime/selector-model.json","utf8"));
  const js = "// OTOMATİK (reconciled: Faz 1-4 motoruyla uzlaştırılmış) — estimatedStrength+focus dağılımına uyumlu.\n"
    + "const BATTLE_SELECTOR_TRAINED_MODEL = " + JSON.stringify(m) + ";\n"
    + "const BATTLE_SELECTOR_AUTO_ENABLE = true;\nconst BATTLE_SELECTOR_AUTO_MIN_TICK = 500;\n"
    + "if (typeof module !== \"undefined\") module.exports = { BATTLE_SELECTOR_TRAINED_MODEL, BATTLE_SELECTOR_AUTO_ENABLE };\n";
  require("fs").writeFileSync("js/BattleSelectorModel.js", js);
  console.log("GÖMÜLDÜ: reconciled model.");
' | tee -a "$LOG"
echo "═══ RECONCILE BİTTİ ═══" | tee -a "$LOG"
