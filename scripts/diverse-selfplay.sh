#!/usr/bin/env bash
# ═══ DIVERSE-SELFPLAY (r1 beyni) — AI, İNSAN-TAKTİĞİ oynayan vekile karşı + VARIED ordularla kendini eğitir ═══
# Fikir: kod-AI'yı yeniyorsun çünkü o senin gibi oynamıyor. Bu eğitimde mavi (rakip) SENİN taktiğini
# (konsantrasyon + odaklı-ateş / 2v1) oynar, kırmızı (model) her tur farklı-dengeli ordu komuta eder →
# AI insan-tarzına karşı, geniş durum yelpazesinde eğitilir. Sen yüzlerce maç oynamadan.
# Çıktı: qa-runtime/selector-model-r1.json (ADAY — oyuna GÖMÜLMEZ; BEYIN-TURNUVA.bat şampiyonu seçer).
# Kullanım: scripts/diverse-selfplay.sh [tur=6] [seed=8]
cd "$(dirname "$0")/.."
Q=qa-runtime; EL="env -u ELECTRON_RUN_AS_NODE npx electron ."
ROUNDS="${1:-6}"; SEEDS="${2:-8}"
LOCK="$Q/.diverse.lock"; [ -f "$LOCK" ] && { echo "Zaten calisiyor (kilit: $LOCK). Bittiyse sil."; exit 0; }
touch "$LOCK"; trap 'rm -f "$LOCK"' EXIT
LOG="$Q/diverse-selfplay-log.txt"; : > "$LOG"
BASE="$Q/oracle-dataset-big.json,$Q/oracle-dagger.json,$Q/dagger-blue1600.json,$Q/dagger-blue1800.json,$Q/oracle-defender.json"
WARM="$Q/selector-model-v4.json"           # v4 gücünden başla (kazanımlar korunur)
[ -f "$WARM" ] || WARM="$Q/selector-model.json"
BUDGETS=(1300 1500 1700 1400 1600 1500 1400 1700)   # rakip bütçe çeşitliliği (lig)
TICKS="600,800,1000,1200,1400"
ACC=""                                     # birikmiş vekil-verisi
echo "═══ DIVERSE-SELFPLAY başladı: $ROUNDS tur × $SEEDS seed (warm=$(basename "$WARM")) ═══" | tee -a "$LOG"
for r in $(seq 1 "$ROUNDS"); do
  B=${BUDGETS[$(( (r-1) % ${#BUDGETS[@]} ))]}
  echo "───── DIVERSE TUR $r/$ROUNDS (insan-taktiği vekil, vs$B, varied-ordu) ─────" | tee -a "$LOG"
  OUT="$Q/diverse-r$r.json"
  SURROGATE=1 $EL --oracledagger "$WARM" 10 "$TICKS" 1 "$SEEDS" "$OUT" "$B" combat 2>&1 \
    | grep -E "DAGGER_YAZILDI|on-policy örnek|DAGGER_SETUP_HATA|JSHATA" | tee -a "$LOG"
  [ -f "$OUT" ] && ACC="${ACC:+$ACC,}$OUT"
  NEW="$Q/selector-model-r1-t$r.json"
  # warm-start ÖNCEKİ turdan (birikimli güç) + base + tüm vekil turları
  node js/BattleSelector.js "${BASE}${ACC:+,$ACC}" 300 "$NEW" "$WARM" 2>&1 \
    | grep -E "Birleştir|Warm-start|DEV |MODEL_KAYDEDILDI" | tee -a "$LOG"
  [ -f "$NEW" ] && WARM="$NEW"
done
cp "$WARM" "$Q/selector-model-r1.json"
echo "═══ r1 HAZIR → $Q/selector-model-r1.json ═══" | tee -a "$LOG"
echo "Sıradaki: BEYIN-TURNUVA.bat (b1 vs v4 vs r1) → şampiyon oyuna gömülür." | tee -a "$LOG"
