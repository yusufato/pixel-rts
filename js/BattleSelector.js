// ═══════════════════════════════════════════════════════════════════════════
// BattleSelector.js — Faz 3: SEÇİCİ MODEL (aday sıralayıcı MLP) + eğitim/değerlendirme
// ───────────────────────────────────────────────────────────────────────────
// Plan §2.0: model ADAY ÜRETMEZ, SIRALAR. Girdi = stateFeatures ⊕ candidateFeatures → skor.
// Öğretmen = karşı-olgusal rollout ödülü (BattleOracle/oracle-dataset.json). Eğitim listwise/MSE.
// İLK SÜRÜM: ileri-beslemeli MLP (özyinelemeli GRU §2.3 sonraki adım). Saf JS, deterministik init.
//
// Ölçüm: model_regret = oracle_ödülü − model_seçtiği_aday_ödülü (Oracle regret'iyle aynı birim).
// Karşılaştırma: default(kod-AI seçimi) vs rastgele-aday vs model. Model < default olmalı (Faz 3 kapısı).
//
// Kullanım (offline): node js/BattleSelector.js [dataset.json] [epochs]
// ═══════════════════════════════════════════════════════════════════════════

// Deterministik PRNG (init + shuffle) — tekrarlanabilir eğitim
function selMakeRng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// ── MLP: D → H → 1 (tanh gizli, lineer çıkış) ─────────────────────────────────
function selInitModel(D, H, rng) {
    const rand = (n, scale) => Array.from({ length: n }, () => (rng() * 2 - 1) * scale);
    const xav1 = Math.sqrt(1 / D), xav2 = Math.sqrt(1 / H);
    return {
        D, H,
        W1: Array.from({ length: H }, () => rand(D, xav1)),   // H×D
        b1: new Array(H).fill(0),
        W2: rand(H, xav2),                                     // H
        b2: 0
    };
}
function selForward(model, x) {
    const { W1, b1, W2, b2, H } = model;
    const z1 = new Array(H), a1 = new Array(H);
    for (let h = 0; h < H; h++) {
        let s = b1[h]; const w = W1[h];
        for (let d = 0; d < x.length; d++) s += w[d] * x[d];
        z1[h] = s; a1[h] = Math.tanh(s);
    }
    let out = b2;
    for (let h = 0; h < H; h++) out += W2[h] * a1[h];
    return { out, a1, z1 };
}
// tek örnek (bir aday) geri-yayılım, gradyanı model'e biriktir (grad accumulator)
function selBackward(model, x, cache, dOut, grad) {
    const { W2, H } = model;
    const { a1, z1 } = cache;
    grad.b2 += dOut;
    for (let h = 0; h < H; h++) {
        grad.W2[h] += dOut * a1[h];
        const dA1 = dOut * W2[h];
        const dZ1 = dA1 * (1 - a1[h] * a1[h]);   // tanh'
        grad.b1[h] += dZ1;
        const gw = grad.W1[h];
        for (let d = 0; d < x.length; d++) gw[d] += dZ1 * x[d];
    }
}
function selZeroGrad(model) {
    return {
        W1: model.W1.map(r => r.map(() => 0)), b1: model.b1.map(() => 0),
        W2: model.W2.map(() => 0), b2: 0
    };
}
function selApplyGrad(model, grad, lr, wd) {
    for (let h = 0; h < model.H; h++) {
        for (let d = 0; d < model.D; d++) model.W1[h][d] -= lr * (grad.W1[h][d] + wd * model.W1[h][d]);
        model.b1[h] -= lr * grad.b1[h];
        model.W2[h] -= lr * (grad.W2[h] + wd * model.W2[h]);
    }
    model.b2 -= lr * grad.b2;
}

// ── Örnek → (girdi vektörleri, hedef z-skorlu ödül) ───────────────────────────
// Her örnek listwise: 64 aday. Hedef = ödülün örnek-içi z-skoru (sıralamayı öğrenir, ölçekten bağımsız).
function selBuildExample(ex) {
    const rewards = ex.rows.map(r => r.reward);
    const mean = rewards.reduce((a, b) => a + b, 0) / rewards.length;
    const varr = rewards.reduce((a, b) => a + (b - mean) * (b - mean), 0) / rewards.length;
    const std = Math.sqrt(varr) || 1;
    const inputs = ex.rows.map(r => ex.stateFeatures.concat(r.features));
    const targets = rewards.map(r => (r - mean) / std);
    return { inputs, targets, rewards };
}

function selTrain(examples, config = {}) {
    const epochs = config.epochs || 300;
    const lr = config.lr || 0.02;
    const wd = config.wd || 1e-4;
    const rng = selMakeRng(config.seed || 12345);
    const built = examples.map(selBuildExample);
    const D = built[0].inputs[0].length, H = config.H || 48;
    const model = selInitModel(D, H, rng);
    let lastLoss = 0;
    for (let ep = 0; ep < epochs; ep++) {
        // örnek sırasını karıştır (listwise: örnek başına tam-batch gradyan)
        const order = built.map((_, i) => i);
        for (let i = order.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
        let loss = 0, n = 0;
        for (const idx of order) {
            const ex = built[idx];
            const grad = selZeroGrad(model);
            for (let c = 0; c < ex.inputs.length; c++) {
                const cache = selForward(model, ex.inputs[c]);
                const err = cache.out - ex.targets[c];
                loss += err * err; n++;
                selBackward(model, ex.inputs[c], cache, 2 * err / ex.inputs.length, grad);
            }
            selApplyGrad(model, grad, lr, wd);
        }
        lastLoss = loss / Math.max(1, n);
        if (config.verbose && (ep % 50 === 0 || ep === epochs - 1)) console.log(`  epoch ${ep} loss=${lastLoss.toFixed(4)}`);
    }
    return { model, loss: lastLoss };
}

// ── Değerlendirme: model regret (oracle − model_seçtiği) vs default vs rastgele ──
function selEvaluate(model, examples) {
    let mRegret = 0, dRegret = 0, rRegret = 0, top1 = 0, n = 0;
    const rng = selMakeRng(999);
    for (const ex of examples) {
        const rewards = ex.rows.map(r => r.reward);
        const best = Math.max(...rewards);
        const bestIdx = rewards.indexOf(best);
        // model seçimi = en yüksek skorlu aday
        let bestScore = -Infinity, pick = 0;
        for (let c = 0; c < ex.rows.length; c++) {
            const x = ex.stateFeatures.concat(ex.rows[c].features);
            const s = selForward(model, x).out;
            if (s > bestScore) { bestScore = s; pick = c; }
        }
        mRegret += best - rewards[pick];
        // default = kod-AI seçimi (chosenReward); rastgele = rastgele aday
        dRegret += Math.max(0, best - (ex.chosenReward != null ? ex.chosenReward : best));
        rRegret += best - rewards[(rng() * rewards.length) | 0];
        if (pick === bestIdx) top1++;
        n++;
    }
    return {
        n, modelRegret: +(mRegret / n).toFixed(1), defaultRegret: +(dRegret / n).toFixed(1),
        randomRegret: +(rRegret / n).toFixed(1), top1Accuracy: +(top1 / n).toFixed(3)
    };
}

// ── Node CLI: dataset yükle → train/dev böl → eğit → değerlendir ──────────────
if (typeof require !== 'undefined' && require.main === module) {
    const fs = require('fs');
    const path = process.argv[2] || require('path').join(__dirname, '..', 'qa-runtime', 'oracle-dataset.json');
    const epochs = parseInt(process.argv[3] || '300', 10);
    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    const all = (data.examples || []).filter(e => e.active && e.rows && e.rows.length > 2);
    console.log(`Dataset: ${all.length} aktif örnek, ${all.reduce((a, e) => a + e.rows.length, 0)} satır (${data.meta ? data.meta.stateVersion + '/' + data.meta.candidateVersion : '?'})`);
    if (all.length < 4) { console.log('Yetersiz veri (≥4 aktif örnek gerekli). Daha çok topla: --oracledata'); process.exit(0); }
    // train/dev böl (örnek bazında — satır sızıntısı yok): %75 train
    const rng = selMakeRng(7);
    const order = all.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
    const cut = Math.max(3, Math.floor(all.length * 0.75));
    const train = order.slice(0, cut).map(i => all[i]);
    const dev = order.slice(cut).map(i => all[i]);
    console.log(`Bölme: ${train.length} train, ${dev.length} dev`);
    const t0 = Date.now();
    const { model, loss } = selTrain(train, { epochs, verbose: true });
    console.log(`Eğitim bitti (${((Date.now() - t0) / 1000).toFixed(1)}s), son loss=${loss.toFixed(4)}`);
    const trEval = selEvaluate(model, train);
    const dvEval = dev.length ? selEvaluate(model, dev) : null;
    console.log('TRAIN  ' + JSON.stringify(trEval));
    if (dvEval) console.log('DEV    ' + JSON.stringify(dvEval));
    console.log('\nYORUM: modelRegret < defaultRegret ve < randomRegret ise model öğreniyor (aday sıralamayı');
    console.log('kod-AI seçiminden daha iyi yapıyor). top1Accuracy = en iyi adayı ilk seçme oranı.');
}

if (typeof module !== 'undefined') module.exports = { selTrain, selEvaluate, selForward, selInitModel, selBuildExample, selMakeRng };
