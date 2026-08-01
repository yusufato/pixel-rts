#!/usr/bin/env bash
# ═══ İNSAN-MAÇI EĞİTİM (Faz 6) — oyunda toplanan insan-verisiyle AI'yı SANA adapte et ═══
# warm-start v4 (gücünü koru) + base + senin maçlarının verisi → adapte model → oyuna göm.
# ÖNEMLİ: yalnız GÜNCEL-motor durumları adapte edilir. Eski-motor (farklı dinamik+ödül) durumları
# atlanır — "eski oyun ile şimdiki oyun çok farklı boyutta", karıştırınca dağılım kayar.
cd "$(dirname "$0")/.."
Q=qa-runtime
if [ ! -f "$Q/human-data.json" ]; then
  echo "Once oyunda birkac Hizli Mac oyna (AI 'bu mactan ogren' ACIK ile). human-data.json henuz yok."
  exit 0
fi
# güncel motor-sürümünü kaynaktan oku + human-data'yi O sürüme göre SÜZ → human-data-current.json
node -e '
  const fs = require("fs");
  const src = fs.readFileSync("js/BattleSession.js", "utf8");
  const m = src.match(/BATTLE_ENGINE_VERSION\s*=\s*[\x27"]([^\x27"]+)[\x27"]/);
  const cur = m ? m[1] : null;
  const d = JSON.parse(fs.readFileSync("qa-runtime/human-data.json", "utf8"));
  const all = d.examples || [];
  const keep = all.filter(e => e.engineVersion === cur);   // etiketsiz/eski-motor durumlar DUSER
  const drop = all.length - keep.length;
  fs.writeFileSync("qa-runtime/human-data-current.json", JSON.stringify({ meta: { createdBy: "in-game", human: true, engineVersion: cur, exampleCount: keep.length }, examples: keep }));
  console.log("Guncel motor: " + cur);
  console.log("Insan-verisi: " + all.length + " durum -> " + keep.length + " GUNCEL adapte edilecek (" + drop + " eski/etiketsiz atlandi)");
  if (!keep.length) { console.log("__NOFRESH__"); }
' | tee /tmp/human-train-filter.log
if grep -q "__NOFRESH__" /tmp/human-train-filter.log; then
  echo ""
  echo ">> GUNCEL-motor insan-verisi YOK. Bu motorla birkac Hizli Mac oyna (AI 'bu mactan ogren' ACIK), sonra tekrar calistir."
  echo "   (Eski durumlar bilerek atlaniyor: eski oyun ile simdiki oyun cok farkli boyutta.)"
  exit 0
fi
N=$(node -e 'try{console.log((JSON.parse(require("fs").readFileSync("qa-runtime/human-data-current.json","utf8")).examples||[]).length)}catch(e){console.log(0)}')
# warm-start MEVCUT modelden (gece-eğitim gömdüyse onun üstüne bin, yoksa v4) → kazanımlar birikir
WARM="$Q/selector-model.json"; [ -f "$WARM" ] || WARM="$Q/selector-model-v4.json"
echo "AI sana adapte ediliyor ($N guncel durum, warm-start: $(basename $WARM))..."
BASE="$Q/oracle-dataset-big.json,$Q/oracle-dagger.json,$Q/dagger-blue1600.json,$Q/dagger-blue1800.json,$Q/oracle-defender.json"
node js/BattleSelector.js "${BASE},$Q/human-data-current.json" 300 "$Q/selector-model-human.json" "$WARM" 2>&1 | grep -E "Birleştir|Warm-start|DEV |MODEL_KAYDEDILDI"
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
