#!/usr/bin/env bash
# ═══ İNSAN-MAÇI EĞİTİM (Faz 6) — oyunda toplanan insan-verisiyle AI'yı SANA adapte et ═══
# warm-start v4 (gücünü koru) + base + senin maçlarının verisi → adapte model → oyuna göm.
cd "$(dirname "$0")/.."
Q=qa-runtime
if [ ! -f "$Q/human-data.json" ]; then
  echo "Once oyunda birkac Hizli Mac oyna (AI 'bu mactan ogren' ACIK ile). human-data.json henuz yok."
  exit 0
fi
N=$(node -e 'try{console.log((JSON.parse(require("fs").readFileSync("qa-runtime/human-data.json","utf8")).examples||[]).length)}catch(e){console.log(0)}')
echo "Insan-verisi: $N durum. AI sana adapte ediliyor (warm-start v4)..."
BASE="$Q/oracle-dataset-big.json,$Q/oracle-dagger.json,$Q/dagger-blue1600.json,$Q/dagger-blue1800.json,$Q/oracle-defender.json"
node js/BattleSelector.js "${BASE},$Q/human-data.json" 300 "$Q/selector-model-human.json" "$Q/selector-model-v4.json" 2>&1 | grep -E "Birleştir|Warm-start|DEV |MODEL_KAYDEDILDI"
# göm (oyun bunu kullanir)
cp "$Q/selector-model-human.json" "$Q/selector-model.json"
node -e '
  const m = JSON.parse(require("fs").readFileSync("qa-runtime/selector-model-human.json","utf8"));
  const js = "// OTOMATİK (insan-maçı adapte) — senin maçlarından öğrenen model.\n"
    + "const BATTLE_SELECTOR_TRAINED_MODEL = " + JSON.stringify(m) + ";\n"
    + "const BATTLE_SELECTOR_AUTO_ENABLE = true;\nconst BATTLE_SELECTOR_AUTO_MIN_TICK = 500;\n"
    + "if (typeof module !== \"undefined\") module.exports = { BATTLE_SELECTOR_TRAINED_MODEL, BATTLE_SELECTOR_AUTO_ENABLE };\n";
  require("fs").writeFileSync("js/BattleSelectorModel.js", js);
  console.log("GOMULDU: AI artik senin tarzina adapte. Yeni Hizli Mac ac, dene.");
'
