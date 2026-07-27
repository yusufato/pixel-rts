#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# AI-EĞİT ORKESTRATÖRÜ (Faz 8 motoru) — "AI Eğit" butonunun arkasındaki döngü.
# Bir TUR = çeşitli-rakip + iki-rol on-policy DAgger → birleştir → retrain → ölç.
# Döngüde çağrılır (her tur bir öncekinin modelini kullanıp güçlendirir = DAgger-lig iterasyonu).
#
# Kullanım:  scripts/ai-train.sh <tur_no> <base_model> <seed_sayisi>
# Örn:       scripts/ai-train.sh 1 qa-runtime/selector-model.json 6
#
# Öğrenme sinyali = Oracle karşı-olgusal rollout (credit-assignment çözülür).
# Çeşitlilik = farklı blue bütçe/kompozisyon + red hem attacker hem defender (dengeli matchup).
# ═══════════════════════════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")/.."

ROUND="${1:-1}"
BASE_MODEL="${2:-qa-runtime/selector-model.json}"
SEEDS="${3:-6}"
TICKS="550,700,850,1000,1150"
Q=qa-runtime
EL="env -u ELECTRON_RUN_AS_NODE npx electron ."

echo "═══ AI-EĞİT TUR $ROUND (base=$BASE_MODEL, $SEEDS seed) ═══"

# 1) ÇEŞİTLİ-RAKİP + İKİ-ROL on-policy DAgger (mevcut model sürerken kendi durumlarını Oracle-etiketle)
#    Rakip çeşitliliği overfit'i kırar; iki rol her iki komutanlığı öğretir; güçlü-blue = dengeli matchup.
echo "[1/4] Çeşitli-rakip DAgger toplama..."
$EL --oracledagger "$BASE_MODEL" 12 "$TICKS" 1 "$SEEDS" "$Q/train-r${ROUND}-atk1400.json" 1400 combat 2>&1 | grep -E "DAGGER_YAZILDI|JSHATA" || true
$EL --oracledagger "$BASE_MODEL" 12 "$TICKS" 1 "$SEEDS" "$Q/train-r${ROUND}-atk1700.json" 1700 combat 2>&1 | grep -E "DAGGER_YAZILDI|JSHATA" || true
$EL --oracledagger "$BASE_MODEL" 12 "$TICKS" 1 "$SEEDS" "$Q/train-r${ROUND}-atkmix.json"  1400 mixed  2>&1 | grep -E "DAGGER_YAZILDI|JSHATA" || true

# 2) BİRLEŞTİR (birikmiş temel + bu turun on-policy verisi) → tekrarlanan iyileşme
echo "[2/4] Veri birleştirme + eğitim..."
DATASETS="$Q/oracle-dataset-big.json,$Q/oracle-dagger.json,$Q/dagger-blue1600.json,$Q/dagger-blue1800.json"
DATASETS="$DATASETS,$Q/train-r${ROUND}-atk1400.json,$Q/train-r${ROUND}-atk1700.json,$Q/train-r${ROUND}-atkmix.json"
NEW_MODEL="$Q/selector-model-r${ROUND}.json"
node js/BattleSelector.js "$DATASETS" 400 "$NEW_MODEL" 2>&1 | grep -E "Birleştirilen|TRAIN|DEV|MODEL_KAYDEDILDI" || true

# 3) ÖLÇ — yeni model kod-AI baseline'a karşı (çeşitli rakip güçleri)
echo "[3/4] Ölçüm (yeni model vs kod-AI baseline)..."
for B in 1400 1700; do
  echo "  vs blue-$B:"
  SEL_MIN=500 SEL_MAX=999999 BLUE_BUDGET=$B $EL --selectorlive "$NEW_MODEL" 4 1 2>&1 | grep -E "SELECTORLIVE_OZET" || true
done

# 4) Rapor
echo "[4/4] Tur $ROUND bitti. Yeni model: $NEW_MODEL"
echo "═══ Bir sonraki tur:  scripts/ai-train.sh $((ROUND+1)) $NEW_MODEL $SEEDS ═══"
