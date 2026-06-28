# Öğrenen Beyin — Eğitim Rehberi (4060 PC)

Oyuna-özel sinir-ağı (NeuralBrain) komutanını **self-play evrimi (ES)** ile eğitir.
Torch GEREKMEZ — sadece `node`. Sim tarayıcıdaki ile **birebir aynı** (`stepSim`), headless koşar.

## Hattın parçaları
| Dosya | Ne yapar |
|---|---|
| `js/BrainState.js` | 240 skaler + 8×16×16 uzaysal girdi kodlayıcı (sis-saygılı, hilesiz) |
| `js/NeuralBrain.js` | ileri-besleme MLP (ReLU/argmax, deterministik) — getWeights/setWeights (ES) |
| `js/NNController.js` | çıkarım kancası: NN → u.intent (posture/menzil); `NN.side` ile bir taraf NN |
| `train/gen_bc.js` | headless maçlardan BrainState girdisi + kural-AI etiketi → `bc_data.json` |
| `train/bc_train.js` | davranış-klonlama + "gerçekten öğreniyor mu" kanıtı (Node backprop) |
| `train/es_train.js` | **ASIL EĞİTİM**: ES self-play (RED=NN vs BLUE=kural), ağırlık evrimi |

## Doğrulanan durum
- **Girdi:** 240 skaler, 0 NaN, hile YOK (sis/gizlilik kapısı + ghost), doygunluk düzeltildi (2 konsey denetimi).
- **Veri:** 17381 örnek, posture ATTACK/HOLD/DISENGAGE (3 manevra), ölü-kanal 20→9.
- **Eğitim gerçek:** BC klon dengeli-doğruluk %100, karışık-etiket %33 (şans) → sahte değil.
- **Keşif:** ES fitness 36.7→73.3 (2×, monoton) → AI kuralın ötesinde yeni kazanan davranış buluyor.

## 4060'ta gece-eğitim
```bash
# tam ağ (~50k param), büyük popülasyon, uzun maç, çok nesil — saatlerce koşar
ES_SIZES=240,96,64,32,20 ES_POP=40 ES_GENS=400 ES_TICKS=900 ES_SIGMA=0.1 node train/es_train.js
```
Çıktı: `train/es_brain.json` (eğitilmiş ağırlıklar). Ayarlar (env):
`ES_SIZES` ağ katmanları · `ES_POP` mutasyon sayısı/nesil · `ES_GENS` nesil · `ES_TICKS` maç-uzunluğu · `ES_SIGMA` mutasyon şiddeti · `ES_INIT` başlangıç ölçeği.

## Eğitilmiş ağı oyuna yükleme
Tarayıcı konsolunda: `nnLoadBrain(<es_brain.json içeriği>)` → `NN.enabled=true` → NN komutanı sürer.
(Determinizm: ReLU/argmax, exp yok → MP/headless güvenli.)

## Lig (50k vs 150k — kullanıcı kararı)
Önce 50k (`240,96,64,32,20`) eğit; sonra 150k (`240,256,128,64,20`) eğitip aynı kurala karşı fitness'larını kıyasla — kazanan kalır.

## İleride: GPU-PPO (hızlandırma)
PPO+GPU daha örnek-verimli ama sim JS'te olduğu için Python↔sim köprüsü ister (büyük iş).
ES bu gece çalışır + keşfi kanıtlandı; PPO ancak ES plato yaparsa gerekir.
İleri yön: ham-girdi/algı sürümü (büyük model, 500k+) — `OGRENEN_BEYIN_PLANI.md`.
