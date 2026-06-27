# Öğrenen Beyin (Aşama-2) — Spec & Yol Haritası

> GPU-farkında grounded araştırma (61 kaynak, doğrulanmış araçlar). Kullanıcının tüm sezgileri doğrulandı.
> Donanım: RTX 4060 (8GB) + 1 ek PC. **GPU = offline eğitim; oyun-içi çıkarım JS'te deterministik.**

## ⭐ Ana bulgu: darboğaz GPU değil, SİM-THROUGHPUT
OpenAI Five **256 GPU'ya karşı 128.000 CPU çekirdeği** kullandı — kıt kaynak ortam-üretimi, gradient değil. ~100k model <1MB, 4060 için trivial; GPU çoğunlukla boş bekler. **Sınırlayıcı: JS-sim'in saniyede kaç oyun-adımı ürettiği.**

## Kararlar (net)
- **Parametre:** 100k'yı BAŞLANGIÇ yapma. **Düello-beyni ~5-20k başla**, komutan-beyni için 100k = TAVAN. Tıkanırsa + sim-throughput sınır değilse büyüt.
- **Eğitim yöntemi: NEUROEVOLUTION ÖNCE** (CMA-ES küçük / OpenAI-ES büyük). Çünkü: **zaten çalışan genome+fitness+spRunMatch döngümüz var** (SelfPlay.js) → 23-param genome'u ~10k ağırlık-vektörüyle değiştirmek küçük değişiklik; ES sadece forward-pass ister (JS'te backprop yok), 2 PC'ye paralelleşir, GPU gerekmez. **PPO sonra** (büyük komutan-beyni için, rollout-farm kurulunca).
- **Sim-in-loop: gerçek JS stepSim'i Node-headless'te AYNEN koştur** (SelfPlay.js zaten gerçek motoru çağırıyor = SIFIR sim-to-game gap). **Python/C++'a PORTLAMA** → desync. Audit: tarayıcı-bağımlılığı render/UI'da, sim çekirdeğinde değil → küçük shim yeter.
- **Determinizm export:** GPU'da float eğit → ağırlıkları JSON export → JS'te **~30-satır kendi matmul'un**. **ReLU-only** (tanh/sigmoid/softmax YASAK — exp tabanlı, motorlar-arası bit-tutarsız), **argmax** çıktı, sabit reduction-sırası. Tier-A (float, aynı-motor MP) önce; Tier-B (INT8 quantize) gerçek cross-engine için. **ONNX/tfjs/brain.js oyun-içi KULLANMA** (non-deterministik).
- **Hibrit:** NN ÖNERİR, deterministik icra UYGULAR. **NN sadece `u.intent` yazar (posture/preferredRange/focusTarget) — bu kanal Aşama-1'de ZATEN kuruldu!** Unit.update onu icra eder + effHP güvenlik-vetosu. İnsan-oyuncu için eski genome fallback.

## Mimari (2 beyin, küçük MLP, ReLU, argmax)
- **DÜELLO-BEYNİ:** permütasyon-değişmez Deep-Sets/PointNet (değişken birim sayısı): paylaşımlı per-unit MLP 16→32→32 → mean+max pool → 64-head → ~12 aksiyon ≈ **11-13k**. Fallback: düz 64x64 MLP ≈ 6-10k. Girdi: ego-özellik + influence-map örnekleri + en-yakın-K düşman (sabit K, sıralı). Çıktı: posture + preferredRange-bucket + focus-target-index.
- **KOMUTAN-BEYNİ:** 80 komutan TEK ağ paylaşır (parametre paylaşımı, MAPPO/CTDE) + sektör/rol embedding. ~128³ MLP ≈ **47k → 60-100k tavan**. Girdi: kaba influence-map grid (8x8/12x12) + cluster özetleri. Çıktı: mod/posture (ADVISOR enum) + Schwerpunkt-cluster-seç + öncelik.

## Yol haritası
- **0. ÖLÇ (ilk iş):** spRunMatch'i Node-headless'te koştur, tek-çekirdek **ticks/sn + maç/sn** ölç. eğitim-süresi = (~1e7-1e8 step) / (ticks/sn × çekirdek × 2 PC). Bu sayı "fizibıl mi / saat mi gün mü"yü belirler. **Sıfır risk, sıfır oyun-değişikliği.**
- **1.** Node-headless rollout farm (shim + çekirdek-başı worker).
- **2.** Düello-beyni küçük ağ + ES (JS-içi); train→export→JS-inference→bit-hash döngüsü.
- **3.** Determinizm export + cross-browser hash testi (+ INT8 Tier-B toggle).
- **4.** Hibrit entegrasyon (NN → u.intent; substrat hazır Unit.js).
- **5.** Komutan-beyni (paylaşımlı politika; burada PPO değerli olabilir).
- **6.** Kanıta-dayalı büyütme (2. PC = daha çok rollout-CPU, 2. GPU değil).

## Doğrulanmış araçlar
- **evosax** (github.com/RobertTLange/evosax) — ES optimizer (CMA-ES/OpenAI-ES), aktif.
- **pycma** (github.com/CMA-ES/pycma) — saf-CPU CMA-ES, küçük-ağ başlangıç.
- **PyTorch** — offline float eğitim + INT8 QAT export (oyun-içi DEĞİL).
- **Stable-Baselines3 v2.9.0 / CleanRL** — 2. faz PPO (blueprint).
- KAÇIN: brain.js (bayat), ONNX-web/tfjs oyun-içi (non-deterministik).

## Dürüst riskler
- **#1: throughput ÖLÇÜLMEDİ** → tüm zaman-tahmini buna bağlı. İlk iş bu.
- Cross-engine bit-aynılık ampirik test ister; **mevcut sim zaten Math.sin/cos kullanıyor** → bugünkü lockstep zaten aynı-tarayıcı-güvenli (gerçek cross-engine MP isteniyorsa sim'i de de-transcendental'leştirmek gerek, NN'den büyük iş).
- INT8 karar-kalitesi göreve-bağlı (held-out doğrula). CMA-ES 100k'a ölçeklenmez (OpenAI-ES'e geç).

---

## 🔒 KİLİTLENMİŞ TASARIM — Düello-beyni (2026-06-27, kullanıcıyla 16-soru Q&A)

**GİRDİ (~337 özellik):**
- Kendi (~20): can%, tip one-hot(9), mühimmat%, menzil, hız, zırh, atış-hazır, veteran-sv, konum(x%,y%), mevcut-posture
- En-yakın 8 düşman ×9 (72): göreli(dx,dy), mesafe, can%, tip-grup, bana-DPS, beni-hedefliyor-mu, atışı-hazır-mı, siperde-mi, mühimmat-durumu
- En-yakın 5 dost ×4 (20): göreli(dx,dy), can%, tip
- Saha-okuma: 8 yön × (tehdit + dost yoğunluğu) (16)
- Izgara 7×7 × 4 kanal (196): tehdit, dost, arazi, kontrol-noktası — BİRİM-MERKEZLİ, DÜNYA-EKSENLİ (döndürme yok → trig yok → determinizm)
- Arazi(self) + en-yakın-CP + bağlam (güç-oranı/faz/moral/görüş-sayısı/sağlıkçı-ikmal-yakın) (~13)

**ÇIKTI (argmax kafaları):** posture(7: COMMIT/HOLD/WITHDRAW/DISENGAGE/SIEGE/FLANK/ENVELOP) + menzil-kademe(4) + odak-hedef(9: 8 düşman + auto) = 20 logit + value-head(PPO). → u.intent (Aşama-1 kanalı).

**AĞ:** MLP [337→64→32→20] + value, ReLU-only, argmax, ~25k param. Tek PAYLAŞILAN ağ (tüm birimler, tip girdiden = parametre paylaşımı).

**EĞİTİM:** PPO + GPU (RTX 4060) + PyTorch + Node-sim köprüsü. Rakip = SELF-PLAY LİGİ (geçmiş sürümler). Ödül = seyrek(maç-sonu kazan+fark+çeşitlilik) + hafif-yoğun(adım-başı hasar-ver/birim-koru). BAŞLANGIÇ = kural-AI'dan ISITMA (behavior cloning → sonra PPO). Kapsam = PER-BİRİM niyet (makro/Schwerpunkt = Foresight kuralı kalır; komutan-beyni sonra).

**ÇIKARIM (oyun-içi):** NeuralBrain.js PPO-export JSON ağırlıkları yükler → forward → argmax → u.intent. Deterministik (ReLU/argmax, exp yok), MP-güvenli. İnsan-oyuncu/intent-yok → kural-AI fallback.

**İNŞA SIRASI:** (1) BrainState.js encode/decode (2) oyun-içi entegrasyon (bayrak) (3) Node-sim env (4) behavior-cloning (5) PPO script (6) köprü/export. → Sonra diğer PC'de gece-eğitim.

---

## v2 — GENİŞLETİLMİŞ TASARIM (su/köprü + T3 girdileri, ~50k param) — KİLİTLENDİ

Sebep: harita ızgara-tabanlı oldu (su geçilmez, köprü geçit, A* yol bulma) + T3 mekanikleri geliyor (pusu kuruldu). NN'in bunları "görmesi" için girdi büyütüldü; oyuna-özel uzman AI hedefi → ~50k parametre.

**GİRDİ: 337 → 421 skaler** (su/köprü +44, T3 +40). Hepsi deterministik (RNG yok), 0..1/−1..1 sabit-ölçek.

**+44 SU/KÖPRÜ** (MapImage.js API'sinden): köprüdeyim-mi · suya-bitişik(sıkışma) · en-yakın-köprü yön+mesafe(3) · A* yol ilk-bacak yön(2) · düz-hat-kapalı-mı(pathBlockedBetween) · yol-sapma-oranı · köprü-kontrol dost/düşman/boş(3) · **5×5 geçilebilirlik ızgarası(25)** · LOS-su/dağ-kesik · geçit-darlığı(2) · su-korumalı-kanat · köprü-yaklaşım-açıklığı · köprü-öbür-yaka-düşman.

**+40 T3** (çoğu mevcut alandan TÜRETİLİR): gizliyim-mi(inForest+ateş-penceresi) · gizli-düşman-şüphesi yön+mesafe(2) · görünür-müyüm · kanat-açık + sol/sağ-örtü(3) · aşırı-yayılma · flanked-mıyım(2)+hedef-flanked · kuşatılma-derecesi · bastırma self+hedef(3) · tempo/son-emir-gecikmesi · C2-bağlı · ikmal-hattı-mesafesi + kesik(2) · mühimmat-tükenme(2) · keşif-oranı · keşif-boşluğu(2) · parça-parça-yenme(localForceRatio) · yükselti-avantajı(3) · veteranlık/moral(3) · bozgun-yayılma · şarj/temas.
> DİSİPLİN: T3 girdilerinin sim-mekaniği (gizli-şüphe, tempo-damgası, hat-kesik) EĞİTİMDEN ÖNCE sim'e girmeli; yoksa beyin boş kanal öğrenir.

**AĞ (önerilen): MLP [421→96→64→32→20] = 49.460 param (~50k).** NeuralBrain.js DEĞİŞMEDEN çalışır (ReLU/argmax/linear, exp yok) — sadece `sizes` dizisi güncellenir; paramCount=Σ(in×out+out) doğrulandı.
- Alternatif-1 (hibrit-conv): 7×7×5 ızgarayı küçük 2D-conv ile işle → ~31k, uzaysal akılda üstün ama NeuralBrain'e ~20 satır deterministik conv + MP-hash testi gerekir.
- Alternatif-2 (deep-sets): düşman/dost için permütasyon-değişmez pool → sabit-K kısıtını kaldırır; odak-head yine en-yakın-8 ister; ilk sürümde gereksiz.

**ÇIKTI:** 7 posture + 4 menzil + 8 odak + 1 value = 20 (aynı).

**EK UZMANLAŞTIRMA (determinizmi bozmadan, öneri):** (1) frame-stack momentum ~20 girdi (Δhp/Δsuppression/düşman-yaklaşıyor) — en yüksek fayda/maliyet; (2) sektör/rol-embedding ~8 (SQUAD enum); (3) auxiliary düşman-niyet-tahmin head'i (sadece eğitim sinyali); (4) faz one-hot ~3 (bedava). → girdi ~449, ilk katman 449×96 ile ~52k (hedef civarı).
> REDDEDİLEN: LSTM/GRU (sigmoid/tanh=exp → MP-determinizm KIRAR; yerine frame-stack), BatchNorm/LayerNorm (running-stats+exp → sabit mean/std JSON normu kullan).

**THROUGHPUT (#1 risk):** intent'i her frame değil her ~15-30 frame güncelle (scanTimer ritmi) → 50k ağ inference'i 20-30× ucuzlar, posture saniyede değişmediği için kalite düşmez.

**İNŞA SIRASI (güncel):** (1) BrainState.js encode (421) — su/köprü+T3 dahil (2) intent throttle (~20f) (3) Node-sim env (4) behavior-cloning (kural-AI'dan) (5) PPO (6) köprü/export JSON → NeuralBrain.sizes=[421,96,64,32,20]. → diğer PC gece-eğitim.
