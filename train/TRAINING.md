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

## TAM KALİTE (kısma yok)
Hem buton hem script artık **gerçek grid harita + ÇEŞİTLİ (simetrik) ordular + UZUN maç (900 tick) + çok-senaryo denoise** kullanır. Hiçbir şey hız için kısılmadı; bu yüzden zayıf PC'de yavaş, 4060'ta hızlı (~1 dk/maç).

### A) Oyun-içi BUTON (tarayıcı, konsol gerekmez)
🧠 AI Eğit → mavi NN modları. Maç-başı async (UI donmaz, uzun maç olsa bile), her 5 nesilde otomatik kaydeder (kesilirse kaybolmaz), bitince NN CANLI + kalıcı. Gerçek haritada eğitir. **Gece/uzun mod**: aç-bırak.

### B) 4060 SCRIPT (node, gece)
```bash
# tam ağ (~50k), büyük popülasyon, uzun maç, çok nesil — saatlerce
ES_SIZES=240,96,64,32,20 ES_POP=32 ES_GENS=300 ES_TICKS=900 ES_SIGMA=0.1 node train/es_train.js
```
Varsayılanlar zaten tam-kalite (TICKS=900, GENS=60, 5-senaryo, çeşitli ordu). Env ile büyüt.
Çıktı: `train/es_brain.json`. Ayarlar: `ES_SIZES` katmanlar · `ES_POP` aday/nesil · `ES_GENS` nesil · `ES_TICKS` maç-uzunluğu · `ES_SIGMA` mutasyon · `ES_INIT` başlangıç.

## Eğitilmiş ağı oyuna yükleme
Tarayıcı konsolunda: `nnLoadBrain(<es_brain.json içeriği>)` → `NN.enabled=true` → NN komutanı sürer.
(Determinizm: ReLU/argmax, exp yok → MP/headless güvenli.)

## Lig (50k vs 150k — kullanıcı kararı)
Önce 50k (`240,96,64,32,20`) eğit; sonra 150k (`240,256,128,64,20`) eğitip aynı kurala karşı fitness'larını kıyasla — kazanan kalır.

## İleride: GPU-PPO (hızlandırma)
PPO+GPU daha örnek-verimli ama sim JS'te olduğu için Python↔sim köprüsü ister (büyük iş).
ES bu gece çalışır + keşfi kanıtlandı; PPO ancak ES plato yaparsa gerekir.
İleri yön: ham-girdi/algı sürümü (büyük model, 500k+) — `OGRENEN_BEYIN_PLANI.md`.
