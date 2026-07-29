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
    // WARM-START: önceki modelden devam et (her tur sıfırdan başlamak yerine → temiz birikim).
    // Boyutlar uyuşuyorsa ağırlıkları kopyala; küçük lr ile ince-ayar mantığı config.lr'de.
    let model = selInitModel(D, H, rng);
    if (config.warmStart && config.warmStart.D === D && config.warmStart.H === H) {
        const w = config.warmStart;
        model.W1 = w.W1.map(r => r.slice()); model.b1 = w.b1.slice();
        model.W2 = w.W2.slice(); model.b2 = w.b2;
    }
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

// ── Node CLI (GRU): node js/BattleSelector.js --gru <sequences.json> <epochs> ──
if (typeof require !== 'undefined' && require.main === module && process.argv.includes('--gru')) {
    const fs = require('fs');
    const gi = process.argv.indexOf('--gru');
    const path = process.argv[gi + 1] || require('path').join(__dirname, '..', 'qa-runtime', 'oracle-sequences.json');
    const epochs = parseInt(process.argv[gi + 2] || '200', 10);
    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    const seqs = (data.sequences || []).filter(s => s.length >= 2 && s.every(st => st.rows && st.rows.length > 2));
    console.log(`GRU dataset: ${seqs.length} sekans, ${seqs.reduce((a, s) => a + s.length, 0)} adım (${data.meta ? data.meta.stateVersion : '?'})`);
    if (seqs.length < 4) { console.log('Yetersiz sekans (≥4). Daha çok topla: --oracleseq'); process.exit(0); }
    const rng = selMakeRng(7);
    const order = seqs.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
    const cut = Math.max(3, Math.floor(seqs.length * 0.75));
    const train = order.slice(0, cut).map(i => seqs[i]), dev = order.slice(cut).map(i => seqs[i]);
    console.log(`Bölme: ${train.length} train, ${dev.length} dev sekans`);
    const t0 = Date.now();
    const { g, loss } = selGruTrain(train, { epochs, verbose: true, H: 64 });
    console.log(`GRU eğitim bitti (${((Date.now() - t0) / 1000).toFixed(1)}s), son loss=${loss.toFixed(4)}`);
    console.log('TRAIN  ' + JSON.stringify(selGruEvaluate(g, train)));
    if (dev.length) console.log('DEV    ' + JSON.stringify(selGruEvaluate(g, dev)));
    console.log('\nYORUM: GRU maç-içi karar DİZİSİNİ h(t) ile özetler (hafıza §2.3). modelRegret<defaultRegret');
    console.log('ise hafızalı seçici de kod-AI\'dan iyi sıralıyor. (Feedforward ile kıyasla: hafıza katkısı.)');
    process.exit(0);
}

// ── Node CLI (EVAL): node js/BattleSelector.js --eval <model> <dataset[,dataset...]> ──
// Verilen modeli verilen durumlarda değerlendirir (eğitmeden). Turnuva için: modelRegret düşük=iyi.
if (typeof require !== 'undefined' && require.main === module && process.argv.includes('--eval')) {
    const fs = require('fs');
    const ei = process.argv.indexOf('--eval');
    const model = JSON.parse(fs.readFileSync(process.argv[ei + 1], 'utf8'));
    const examples = [];
    for (const p of (process.argv[ei + 2] || '').split(',').filter(Boolean)) {
        try { const d = JSON.parse(fs.readFileSync(p, 'utf8')); for (const ex of (d.examples || [])) if (ex.rows && ex.rows.length > 1) examples.push(ex); }
        catch (e) { console.log('EVAL_HATA ' + p + ' ' + e.message); }
    }
    if (!examples.length) { console.log('EVAL_SONUC {"n":0}'); process.exit(0); }
    console.log('EVAL_SONUC ' + JSON.stringify(selEvaluate(model, examples)));
    process.exit(0);
}

// ── Node CLI (MLP): dataset yükle → train/dev böl → eğit → değerlendir ─────────
if (typeof require !== 'undefined' && require.main === module && !process.argv.includes('--eval')) {
    const fs = require('fs');
    const pathArg = process.argv[2] || require('path').join(__dirname, '..', 'qa-runtime', 'oracle-dataset.json');
    const epochs = parseInt(process.argv[3] || '300', 10);
    // virgülle-ayrık birden çok dataset → birleştir (off-policy + on-policy DAgger karışımı)
    const files = pathArg.split(',').map(p => p.trim()).filter(Boolean);
    let data = null, mergedExamples = [];
    for (const f of files) {
        const d = JSON.parse(fs.readFileSync(f, 'utf8'));
        if (!data) data = d;
        mergedExamples = mergedExamples.concat(d.examples || []);
    }
    data = { meta: data.meta, examples: mergedExamples };
    if (files.length > 1) console.log(`Birleştirilen: ${files.length} dosya → ${mergedExamples.length} örnek`);
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
    // WARM-START (arg 5): önceki modelden devam → temiz birikim (her tur sıfırdan başlamaz)
    let warmStart = null;
    const wsPath = process.argv[5];
    if (wsPath && wsPath !== '-') { try { warmStart = JSON.parse(fs.readFileSync(wsPath, 'utf8')); console.log('Warm-start: ' + wsPath); } catch (e) { console.log('Warm-start okunamadı: ' + e.message); } }
    const { model, loss } = selTrain(train, { epochs, verbose: true, warmStart, lr: warmStart ? 0.01 : 0.02 });
    console.log(`Eğitim bitti (${((Date.now() - t0) / 1000).toFixed(1)}s), son loss=${loss.toFixed(4)}`);
    const trEval = selEvaluate(model, train);
    const dvEval = dev.length ? selEvaluate(model, dev) : null;
    console.log('TRAIN  ' + JSON.stringify(trEval));
    if (dvEval) console.log('DEV    ' + JSON.stringify(dvEval));
    // modeli kaydet (canlı entegrasyon için — BattleOracle battleSelectorSetModel ile yükler)
    const outModel = process.argv[4] || require('path').join(__dirname, '..', 'qa-runtime', 'selector-model.json');
    try {
        fs.writeFileSync(outModel, JSON.stringify({
            stateVersion: data.meta ? data.meta.stateVersion : null,
            candidateVersion: data.meta ? data.meta.candidateVersion : null,
            D: model.D, H: model.H, W1: model.W1, b1: model.b1, W2: model.W2, b2: model.b2,
            trainedOn: { examples: train.length, epochs, dev: dvEval }
        }));
        console.log('MODEL_KAYDEDILDI ' + outModel);
    } catch (e) { console.log('MODEL_KAYIT_HATA ' + e.message); }
    console.log('\nYORUM: modelRegret < defaultRegret ve < randomRegret ise model öğreniyor (aday sıralamayı');
    console.log('kod-AI seçiminden daha iyi yapıyor). top1Accuracy = en iyi adayı ilk seçme oranı.');
}

// ═══════════════════════════════════════════════════════════════════════════
// GRU seçici (§2.3): HAFIZALI — maç-içi karar dizisini h(t) ile özetler, sonra her adayı
// (h(t) ⊕ candidateFeatures) MLP ile skorlar. GRU aday başına DEĞİL, karar başına 1 kez çalışır
// (review #5). Kısa diziler (maç başına 3-4 karar) → full BPTT tractable.
// ───────────────────────────────────────────────────────────────────────────
function selSigmoid(x) { return 1 / (1 + Math.exp(-x)); }
function selGruInit(D, H, Hout, rng) {
    const rand = (r, c, s) => Array.from({ length: r }, () => Array.from({ length: c }, () => (rng() * 2 - 1) * s));
    const sx = Math.sqrt(1 / (D + H));
    return {
        D, H, Hout,
        Wz: rand(H, D + H, sx), bz: new Array(H).fill(0),
        Wr: rand(H, D + H, sx), br: new Array(H).fill(0),
        Wh: rand(H, D + H, sx), bh: new Array(H).fill(0),
        // çıkış skorlayıcı MLP: (H + Hout) → Hh → 1  (Hout = candidateFeature uzunluğu)
        Wo1: rand(48, H + Hout, Math.sqrt(1 / (H + Hout))), bo1: new Array(48).fill(0),
        Wo2: Array.from({ length: 48 }, () => (rng() * 2 - 1) * Math.sqrt(1 / 48)), bo2: 0
    };
}
// tek GRU adımı; cache döndür (BPTT için)
function selGruStep(g, x, hPrev) {
    const H = g.H, xh = x.concat(hPrev);
    const z = new Array(H), r = new Array(H), hh = new Array(H), h = new Array(H), rh = new Array(H);
    for (let i = 0; i < H; i++) {
        let sz = g.bz[i], sr = g.br[i];
        const wz = g.Wz[i], wr = g.Wr[i];
        for (let j = 0; j < xh.length; j++) { sz += wz[j] * xh[j]; sr += wr[j] * xh[j]; }
        z[i] = selSigmoid(sz); r[i] = selSigmoid(sr);
    }
    const xrh = x.concat(hPrev.map((v, i) => r[i] * v));
    for (let i = 0; i < H; i++) {
        let sh = g.bh[i]; const wh = g.Wh[i];
        for (let j = 0; j < xrh.length; j++) sh += wh[j] * xrh[j];
        hh[i] = Math.tanh(sh);
        h[i] = (1 - z[i]) * hPrev[i] + z[i] * hh[i];
        rh[i] = r[i] * hPrev[i];
    }
    return { x, hPrev, z, r, hh, h, xh, xrh, rh };
}
// çıkış skoru: MLP(h ⊕ cand)
function selGruScore(g, h, cand) {
    const inp = h.concat(cand), H1 = 48;
    const a1 = new Array(H1), z1 = new Array(H1);
    for (let k = 0; k < H1; k++) {
        let s = g.bo1[k]; const w = g.Wo1[k];
        for (let j = 0; j < inp.length; j++) s += w[j] * inp[j];
        z1[k] = s; a1[k] = Math.tanh(s);
    }
    let out = g.bo2; for (let k = 0; k < H1; k++) out += g.Wo2[k] * a1[k];
    return { out, a1, inp };
}
// bir maç dizisi (adımlar: {stateFeatures, rows:[{features,reward}]}) → forward + full BPTT gradyan biriktir
function selGruSeqForwardBackward(g, steps, grad, lossAcc) {
    const H = g.H;
    let hPrev = new Array(H).fill(0);
    const caches = [], scoreCaches = [], targetsAll = [];
    // FORWARD: her adımda h_t + aday skorları
    for (const st of steps) {
        const cache = selGruStep(g, st.stateFeatures, hPrev);
        caches.push(cache);
        const rewards = st.rows.map(r => r.reward);
        const mean = rewards.reduce((a, b) => a + b, 0) / rewards.length;
        const std = Math.sqrt(rewards.reduce((a, b) => a + (b - mean) * (b - mean), 0) / rewards.length) || 1;
        const scs = st.rows.map((row, ci) => {
            const sc = selGruScore(g, cache.h, row.features);
            const tgt = (rewards[ci] - mean) / std;
            lossAcc.loss += (sc.out - tgt) * (sc.out - tgt); lossAcc.n++;
            return { sc, tgt, cand: row.features, nCand: st.rows.length };
        });
        scoreCaches.push(scs); targetsAll.push(rewards);
        hPrev = cache.h;
    }
    // BACKWARD: çıkıştan h_t'ye + BPTT (h_t → h_{t-1})
    let dhNext = new Array(H).fill(0);   // sonraki adımdan gelen dh
    for (let t = steps.length - 1; t >= 0; t--) {
        const cache = caches[t], scs = scoreCaches[t];
        const dh = dhNext.slice();   // bu adımın h'sine gelen toplam gradyan
        // çıkış MLP gradyanları (bu adımdaki tüm adaylar)
        for (const s of scs) {
            const dOut = 2 * (s.sc.out - s.tgt) / s.nCand;
            grad.bo2 += dOut;
            for (let k = 0; k < 48; k++) {
                grad.Wo2[k] += dOut * s.sc.a1[k];
                const dA1 = dOut * g.Wo2[k];
                const dZ1 = dA1 * (1 - s.sc.a1[k] * s.sc.a1[k]);
                grad.bo1[k] += dZ1;
                const gw = grad.Wo1[k];
                for (let j = 0; j < s.sc.inp.length; j++) gw[j] += dZ1 * s.sc.inp[j];
                // inp = h ⊕ cand → h kısmına gradyan
                for (let i = 0; i < H; i++) dh[i] += dZ1 * g.Wo1[k][i];
            }
        }
        // GRU adımı geri: h = (1-z)*hPrev + z*hh
        const dhPrev = new Array(H).fill(0);
        const xh = cache.xh, xrh = cache.xrh, D = g.D;
        for (let i = 0; i < H; i++) {
            const dHh = dh[i] * cache.z[i];
            const dZ = dh[i] * (cache.hh[i] - cache.hPrev[i]);
            dhPrev[i] += dh[i] * (1 - cache.z[i]);
            // hh = tanh(Wh·xrh) → pre-act grad
            const dHhPre = dHh * (1 - cache.hh[i] * cache.hh[i]);
            grad.bh[i] += dHhPre;
            const gwh = grad.Wh[i];
            for (let j = 0; j < xrh.length; j++) gwh[j] += dHhPre * xrh[j];
            // xrh = x ⊕ (r*hPrev): hPrev kısmına (r*hPrev) üzerinden
            for (let i2 = 0; i2 < H; i2++) {
                const contrib = dHhPre * g.Wh[i][D + i2];   // d(hh_i)/d(rh_i2)
                dhPrev[i2] += contrib * cache.r[i2];
                // r_i2 gradyanı → sigmoid geri
                const dR = contrib * cache.hPrev[i2];
                const dRpre = dR * cache.r[i2] * (1 - cache.r[i2]);
                grad.br[i2] += dRpre;
                const gwr = grad.Wr[i2];
                for (let j = 0; j < xh.length; j++) gwr[j] += dRpre * xh[j];
                if (D + i >= 0) dhPrev[i] += dRpre * g.Wr[i2][D + i];   // xh'nin hPrev kısmı
            }
            // z sigmoid geri
            const dZpre = dZ * cache.z[i] * (1 - cache.z[i]);
            grad.bz[i] += dZpre;
            const gwz = grad.Wz[i];
            for (let j = 0; j < xh.length; j++) gwz[j] += dZpre * xh[j];
            for (let i2 = 0; i2 < H; i2++) dhPrev[i2] += dZpre * g.Wz[i][D + i2];
        }
        dhNext = dhPrev;
    }
}
function selGruZeroGrad(g) {
    const z2 = (r, c) => Array.from({ length: r }, () => new Array(c).fill(0));
    return {
        Wz: z2(g.H, g.D + g.H), bz: new Array(g.H).fill(0),
        Wr: z2(g.H, g.D + g.H), br: new Array(g.H).fill(0),
        Wh: z2(g.H, g.D + g.H), bh: new Array(g.H).fill(0),
        Wo1: z2(48, g.H + g.Hout), bo1: new Array(48).fill(0),
        Wo2: new Array(48).fill(0), bo2: 0
    };
}
function selGruApply(g, grad, lr, wd) {
    const H = g.H;
    for (let i = 0; i < H; i++) {
        for (let j = 0; j < g.D + H; j++) {
            g.Wz[i][j] -= lr * (grad.Wz[i][j] + wd * g.Wz[i][j]);
            g.Wr[i][j] -= lr * (grad.Wr[i][j] + wd * g.Wr[i][j]);
            g.Wh[i][j] -= lr * (grad.Wh[i][j] + wd * g.Wh[i][j]);
        }
        g.bz[i] -= lr * grad.bz[i]; g.br[i] -= lr * grad.br[i]; g.bh[i] -= lr * grad.bh[i];
    }
    for (let k = 0; k < 48; k++) {
        for (let j = 0; j < g.H + g.Hout; j++) g.Wo1[k][j] -= lr * (grad.Wo1[k][j] + wd * g.Wo1[k][j]);
        g.bo1[k] -= lr * grad.bo1[k];
        g.Wo2[k] -= lr * (grad.Wo2[k] + wd * g.Wo2[k]);
    }
    g.bo2 -= lr * grad.bo2;
}
// sekans-eğitim: sequences = [ [step, step, ...], ... ] (her step = {stateFeatures, rows})
function selGruTrain(sequences, config = {}) {
    const epochs = config.epochs || 200, lr = config.lr || 0.02, wd = config.wd || 1e-4;
    const rng = selMakeRng(config.seed || 4242);
    const D = sequences[0][0].stateFeatures.length;
    const Hout = sequences[0][0].rows[0].features.length;
    const g = selGruInit(D, config.H || 64, Hout, rng);
    let last = 0;
    for (let ep = 0; ep < epochs; ep++) {
        const order = sequences.map((_, i) => i);
        for (let i = order.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
        const lossAcc = { loss: 0, n: 0 };
        for (const idx of order) {
            const grad = selGruZeroGrad(g);
            selGruSeqForwardBackward(g, sequences[idx], grad, lossAcc);
            selGruApply(g, grad, lr, wd);
        }
        last = lossAcc.loss / Math.max(1, lossAcc.n);
        if (config.verbose && (ep % 40 === 0 || ep === epochs - 1)) console.log(`  [GRU] epoch ${ep} loss=${last.toFixed(4)}`);
    }
    return { g, loss: last };
}
// GRU değerlendirme: her maç dizisini forward'la, her adımda model-seçtiği aday regret'i
function selGruEvaluate(g, sequences) {
    let mReg = 0, dReg = 0, n = 0;
    for (const seq of sequences) {
        let h = new Array(g.H).fill(0);
        for (const st of seq) {
            const cache = selGruStep(g, st.stateFeatures, h); h = cache.h;
            const rewards = st.rows.map(r => r.reward), best = Math.max(...rewards);
            let bs = -Infinity, pick = 0;
            for (let c = 0; c < st.rows.length; c++) { const s = selGruScore(g, h, st.rows[c].features).out; if (s > bs) { bs = s; pick = c; } }
            mReg += best - rewards[pick];
            dReg += Math.max(0, best - (st.chosenReward != null ? st.chosenReward : best));
            n++;
        }
    }
    return { n, modelRegret: +(mReg / n).toFixed(1), defaultRegret: +(dReg / n).toFixed(1) };
}

if (typeof module !== 'undefined') module.exports = {
    selTrain, selEvaluate, selForward, selInitModel, selBuildExample, selMakeRng,
    selGruTrain, selGruEvaluate, selGruStep, selGruScore, selGruInit
};
