// ═══════════════════════════════════════════════════════════════════════════
//  NNController.js — ÖĞRENEN BEYİN ÇIKARIM KANCASI (BrainState → NeuralBrain → u.intent)
//  ----------------------------------------------------------------------------
//  Sözleşme: Commander heuristik intent'i yazdıktan SONRA, NN AKTİFSE per-birim
//  posture+menzil'i NN ezer (makro/Schwerpunkt = Foresight/Commander kuralı KALIR).
//  THROTTLE: her komutan-döngüsünde değil, ~N döngüde bir çıkarım (throughput #1 risk).
//  Determinist: NeuralBrain (ReLU/argmax, exp yok) + döngü-sayacı throttle → MP/headless güvenli.
//  Varsayılan KAPALI (NN.enabled=false) → eğitilmiş ağ yüklenene kadar kural-AI oynar.
//
//  Çıktı düzeni (20): [0..6]=posture(7) · [7..10]=menzil-kademe(4) · [11..18]=odak(8) · [19]=value
//  ŞİMDİ: skaler-MLP yolu (BrainState.scalars, 225→...→20). Hibrit conv kolu sonra eklenecek.
// ═══════════════════════════════════════════════════════════════════════════
const NN = {
    brain: null,                 // NeuralBrain örneği (yoksa kural-AI)
    enabled: false,              // true → NN per-birim posture/menzil yazar
    throttleCycles: 2,           // kaç komutan-döngüsünde bir çıkarım (1=her döngü)
    POSTURES: ['COMMIT', 'HOLD', 'WITHDRAW', 'DISENGAGE', 'SIEGE', 'FLANK', 'ENVELOP'],
    RANGE_TIERS: [0.50, 0.72, 0.90, 1.05],
    // 7 NN postürünü mevcut motor davranışına eşle (FLANK/ENVELOP/SIEGE ileride ayrı davranış kazanır)
    toEngine(p) {
        if (p === 'HOLD' || p === 'SIEGE') return 'HOLD';
        if (p === 'WITHDRAW' || p === 'DISENGAGE') return 'DISENGAGE';
        return 'ATTACK';   // COMMIT/FLANK/ENVELOP
    }
};

// Eğitilmiş ağı yükle (JSON: {sizes, weights}) → aktif et. Döner: parametre sayısı.
function nnLoadBrain(json) {
    if (typeof NeuralBrain === 'undefined') return 0;
    NN.brain = (json && json.sizes) ? NeuralBrain.fromJSON(json) : null;
    NN.enabled = !!NN.brain;
    return NN.brain ? NN.brain.nParams : 0;
}
// TEST: belirli mimaride deterministik rastgele ağ (eğitilmiş ağ yokken çıkarım hattını denemek için)
function nnTestBrain(sizes) {
    if (typeof NeuralBrain === 'undefined') return 0;
    sizes = sizes || [BrainState.SCALAR_DIM, 96, 64, 32, 20];
    const b = new NeuralBrain(sizes);
    const w = b.getWeights();
    for (let i = 0; i < w.length; i++) w[i] = (seededRandom(i * 2.399 + 7.13) - 0.5) * 0.8;   // determinist (MP-güvenli)
    b.setWeights(w);
    NN.brain = b; NN.enabled = true;
    return b.nParams;
}
function nnOff() { NN.enabled = false; }

// per-birim intent ezme (throttle'lı). Commander.cmdrOrderUnit sonunda çağrılır.
function nnApplyIntent(u) {
    if (!NN.enabled || !NN.brain || typeof BrainState === 'undefined' || !u.intent) return;
    // THROTTLE: önbellekteki kararı kullan, sadece N döngüde bir yeniden çıkar
    u._nnCd = (u._nnCd || 0) - 1;
    if (u._nnCd > 0 && u._nnPosture) {
        u.intent.posture = u._nnPosture;
        u.intent.preferredRange = u._nnRange;
        return;
    }
    u._nnCd = NN.throttleCycles;
    const st = BrainState.encode(u);                       // {scalars, spatial}
    if (NN.brain.sizes[0] !== st.scalars.length) return;  // mimari uyumsuz → kural-AI kalsın
    const out = NN.brain.forward(st.scalars);             // skaler-MLP (hibrit conv sonra)
    const pIx = NN.brain.argmax(out, 0, 7);
    const rIx = NN.brain.argmax(out, 7, 11) - 7;
    const rawPosture = NN.POSTURES[pIx] || 'COMMIT';
    u.nnPosture = rawPosture;                              // ham postür (telemetri + gelecek davranışlar)
    u.intent.posture = NN.toEngine(rawPosture);
    u.intent.preferredRange = NN.RANGE_TIERS[rIx] != null ? NN.RANGE_TIERS[rIx] : 0.72;
    u._nnPosture = u.intent.posture; u._nnRange = u.intent.preferredRange;
    // ODAK head'i (11..18) ileride: en-yakın-8'den hedef seçimi (şimdilik heuristik focusTarget kalır)
}

if (typeof module !== 'undefined' && module.exports) module.exports = { NN, nnLoadBrain, nnTestBrain, nnApplyIntent };
