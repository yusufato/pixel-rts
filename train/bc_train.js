// ═══════════════════════════════════════════════════════════════════════════
//  train/bc_train.js — DAVRANIŞ-KLONLAMA EĞİTİCİSİ + "GERÇEKTEN ÖĞRENİYOR MU" KANITI
//  ----------------------------------------------------------------------------
//  bc_data.json (BrainState 246 skaler → kural-AI posture etiketi) üzerinde MLP'yi
//  backprop+Adam ile eğitir. ASIL AMAÇ: eğitimin SAHTE değil GERÇEK olduğunu kanıtlamak.
//  3 KANIT:
//   1) GERÇEK   : val dengeli-doğruluk şanstan belirgin yüksek → girdiden sinyal öğreniliyor
//   2) KARIŞIK  : etiketler karıştırılınca val dengeli-doğruluk ≈ şans → sahte/sızıntı YOK (kontrol)
//   3) AŞIRI-FIT: küçük partide kayıp ≈ 0 → backprop mekaniği çalışıyor
//  Çalıştır: node train/bc_train.js  (önce: node train/gen_bc.js --full)
//  Determinist (seed'li RNG). Eğitilmiş ağ NeuralBrain JSON formatında export edilebilir.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

// ── seed'li RNG (tekrarlanabilir) ──
let _s = 1234567;
function rnd() { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 4294967296; }
function gauss() { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// ── veri ──
function loadData(p) {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    const D = raw[0].s.length;
    const classes = [...new Set(raw.map(r => r.posture))].sort();
    const ci = Object.fromEntries(classes.map((c, k) => [c, k]));
    const X = raw.map(r => Float64Array.from(r.s));
    const Y = raw.map(r => ci[r.posture]);
    return { X, Y, classes, D, N: raw.length };
}
function shuffleIdx(n) { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ── MLP (backprop + Adam) ──
class Net {
    constructor(sizes) {
        this.sizes = sizes; this.L = sizes.length - 1;
        this.W = []; this.b = []; this.mW = []; this.vW = []; this.mb = []; this.vb = [];
        for (let l = 0; l < this.L; l++) {
            const ind = sizes[l], outd = sizes[l + 1];
            const scale = Math.sqrt(2 / ind);   // He init
            const w = new Float64Array(ind * outd); for (let i = 0; i < w.length; i++) w[i] = gauss() * scale;
            this.W.push(w); this.b.push(new Float64Array(outd));
            this.mW.push(new Float64Array(ind * outd)); this.vW.push(new Float64Array(ind * outd));
            this.mb.push(new Float64Array(outd)); this.vb.push(new Float64Array(outd));
        }
        this.t = 0;
    }
    forward(x, cache) {              // cache.a[l] aktivasyonlar; çıktı softmax
        let cur = x; if (cache) cache.a = [x];
        for (let l = 0; l < this.L; l++) {
            const ind = this.sizes[l], outd = this.sizes[l + 1], w = this.W[l], b = this.b[l];
            const z = new Float64Array(outd);
            for (let j = 0; j < outd; j++) { let s = b[j]; for (let i = 0; i < ind; i++) s += cur[i] * w[i * outd + j]; z[j] = s; }
            if (l < this.L - 1) { for (let j = 0; j < outd; j++) if (z[j] < 0) z[j] = 0; }   // ReLU
            else { let mx = -Infinity; for (const v of z) if (v > mx) mx = v; let sm = 0; for (let j = 0; j < outd; j++) { z[j] = Math.exp(z[j] - mx); sm += z[j]; } for (let j = 0; j < outd; j++) z[j] /= sm; }
            cur = z; if (cache) cache.a.push(z);
        }
        return cur;
    }
    backward(cache, yTrue, gradAcc) {
        const out = cache.a[this.L];
        let delta = new Float64Array(out.length);
        for (let j = 0; j < out.length; j++) delta[j] = out[j] - (j === yTrue ? 1 : 0);   // softmax+CE grad
        for (let l = this.L - 1; l >= 0; l--) {
            const ind = this.sizes[l], outd = this.sizes[l + 1], a = cache.a[l];
            const gW = gradAcc.W[l], gb = gradAcc.b[l];
            for (let j = 0; j < outd; j++) { gb[j] += delta[j]; const dj = delta[j]; for (let i = 0; i < ind; i++) gW[i * outd + j] += a[i] * dj; }
            if (l > 0) {
                const prev = new Float64Array(ind), w = this.W[l], az = cache.a[l];
                for (let i = 0; i < ind; i++) { let s = 0; for (let j = 0; j < outd; j++) s += w[i * outd + j] * delta[j]; prev[i] = az[i] > 0 ? s : 0; }
                delta = prev;
            }
        }
    }
    zeroGrad() { return { W: this.W.map(w => new Float64Array(w.length)), b: this.b.map(b => new Float64Array(b.length)) }; }
    adam(g, n, lr) {
        this.t++; const b1 = 0.9, b2 = 0.999, eps = 1e-8;
        const c1 = 1 - Math.pow(b1, this.t), c2 = 1 - Math.pow(b2, this.t);
        for (let l = 0; l < this.L; l++) {
            const w = this.W[l], gw = g.W[l], mw = this.mW[l], vw = this.vW[l];
            for (let i = 0; i < w.length; i++) { const gr = gw[i] / n; mw[i] = b1 * mw[i] + (1 - b1) * gr; vw[i] = b2 * vw[i] + (1 - b2) * gr * gr; w[i] -= lr * (mw[i] / c1) / (Math.sqrt(vw[i] / c2) + eps); }
            const b = this.b[l], gb = g.b[l], mb = this.mb[l], vb = this.vb[l];
            for (let j = 0; j < b.length; j++) { const gr = gb[j] / n; mb[j] = b1 * mb[j] + (1 - b1) * gr; vb[j] = b2 * vb[j] + (1 - b2) * gr * gr; b[j] -= lr * (mb[j] / c1) / (Math.sqrt(vb[j] / c2) + eps); }
        }
    }
    weightNorm() { let s = 0; for (const w of this.W) for (const v of w) s += v * v; return Math.sqrt(s); }
}

function trainNet(net, X, Y, idx, nClass, opts) {
    const { epochs, batch, lr } = opts;
    let lastLoss = 0;
    for (let e = 0; e < epochs; e++) {
        const order = shuffleIdx(idx.length);
        let loss = 0, seen = 0;
        for (let bi = 0; bi < order.length; bi += batch) {
            const g = net.zeroGrad(); let n = 0;
            for (let k = bi; k < Math.min(bi + batch, order.length); k++) {
                const s = idx[order[k]]; const cache = {}; const out = net.forward(X[s], cache);
                loss += -Math.log(Math.max(1e-9, out[Y[s]])); seen++;
                net.backward(cache, Y[s], g); n++;
            }
            net.adam(g, n, lr);
        }
        lastLoss = loss / seen;
    }
    return lastLoss;
}
function evalBalanced(net, X, Y, idx, nClass) {
    const correct = new Array(nClass).fill(0), total = new Array(nClass).fill(0); let raw = 0;
    for (const s of idx) {
        const out = net.forward(X[s], null); let am = 0; for (let j = 1; j < out.length; j++) if (out[j] > out[am]) am = j;
        total[Y[s]]++; if (am === Y[s]) { correct[Y[s]]++; raw++; }
    }
    const recalls = correct.map((c, k) => total[k] ? c / total[k] : 0);
    const bal = recalls.reduce((a, b) => a + b, 0) / nClass;
    return { bal, raw: raw / idx.length, recalls, total };
}

// ── ANA ──
const DATA = path.join(__dirname, 'bc_data.json');
if (!fs.existsSync(DATA)) { console.error('bc_data.json yok → önce: node train/gen_bc.js --full'); process.exit(1); }
const { X, Y, classes, D, N } = loadData(DATA);
const nClass = classes.length;
// ABLASYON: etiket-sızıntısı testi — verilen indeksleri sıfırla (ör. --ablate=18 = mevcut-posture girdisi)
const ablArg = (process.argv.find(a => a.startsWith('--ablate=')) || '').split('=')[1];
if (ablArg) { const abl = ablArg.split(',').map(Number); for (const x of X) for (const idx of abl) x[idx] = 0; console.log('ABLASYON: sıfırlanan girdiler =', abl.join(',')); }
console.log(`Veri: ${N} örnek, ${D} girdi, sınıflar: ${classes.join('/')} (${nClass})`);
const all = shuffleIdx(N);
const nv = Math.floor(N * 0.15);
const valIdx = all.slice(0, nv), trIdx = all.slice(nv);
// sınıf dağılımı + şans (dengeli=1/nClass, çoğunluk-baz)
const dist = new Array(nClass).fill(0); for (const s of all) dist[Y[s]]++;
const chance = (1 / nClass * 100).toFixed(0);
console.log(`Dağılım: ${classes.map((c, k) => c + '=' + dist[k]).join(' ')} | dengeli-şans=${chance}%`);

const SIZES = [D, 64, 32, nClass];
console.log(`Ağ: [${SIZES.join(',')}]\n`);

// 1) GERÇEK
console.log('① GERÇEK eğitim...');
let net = new Net(SIZES); const w0 = net.weightNorm();
const realLoss = trainNet(net, X, Y, trIdx, nClass, { epochs: 20, batch: 128, lr: 0.002 });
const realEv = evalBalanced(net, X, Y, valIdx, nClass);
console.log(`   son-kayıp=${realLoss.toFixed(3)} | val dengeli-doğruluk=${(realEv.bal * 100).toFixed(1)}% | ham=${(realEv.raw * 100).toFixed(1)}% | sınıf-recall=[${realEv.recalls.map(r => (r * 100).toFixed(0) + '%').join(',')}] | ağırlık-Δ=${(net.weightNorm() - w0).toFixed(2)}`);

// 2) KARIŞIK ETİKET KONTROLÜ (sahte/sızıntı testi)
console.log('② KARIŞIK-etiket kontrolü (öğrenecek gerçek sinyal var mı)...');
_s = 99; const Ysh = Y.slice(); const perm = shuffleIdx(N); for (let i = 0; i < N; i++) Ysh[i] = Y[perm[i]];
let netSh = new Net(SIZES);
trainNet(netSh, X, Ysh, trIdx, nClass, { epochs: 20, batch: 128, lr: 0.002 });
const shEv = evalBalanced(netSh, X, Ysh, valIdx, nClass);
console.log(`   val dengeli-doğruluk=${(shEv.bal * 100).toFixed(1)}% (şans≈${chance}% olmalı → sinyal gerçek)`);

// 3) AŞIRI-FIT (backprop mekaniği çalışıyor mu)
console.log('③ AŞIRI-FIT (küçük parti, kayıp→0 olmalı)...');
_s = 777; let netOf = new Net(SIZES); const tiny = trIdx.slice(0, 200);
const ofLoss = trainNet(netOf, X, Y, tiny, nClass, { epochs: 200, batch: 64, lr: 0.003 });
const ofEv = evalBalanced(netOf, X, Y, tiny, nClass);
console.log(`   küçük-parti kayıp=${ofLoss.toFixed(4)} | eğitim-doğruluk=${(ofEv.raw * 100).toFixed(1)}%`);

// ── KARAR ──
const realOK = realEv.bal > (1 / nClass + 0.12);
const shOK = shEv.bal < (1 / nClass + 0.10);
const ofOK = ofLoss < 0.15;
console.log('\n═══ KARAR ═══');
console.log(`① GERÇEK öğreniyor : ${realOK ? '✓ EVET' : '✗ HAYIR'} (dengeli ${(realEv.bal * 100).toFixed(0)}% vs şans ${chance}%)`);
console.log(`② sinyal GERÇEK    : ${shOK ? '✓ EVET' : '✗ ŞÜPHELİ'} (karışık ${(shEv.bal * 100).toFixed(0)}% ≈ şans)`);
console.log(`③ backprop ÇALIŞIYOR: ${ofOK ? '✓ EVET' : '✗ HAYIR'} (aşırı-fit kayıp ${ofLoss.toFixed(3)})`);
console.log((realOK && shOK && ofOK)
    ? '\n🎓 EĞİTİM GERÇEK — AI girdiden anlamlı sinyal öğreniyor (sahte değil). Eğitim aşamasına HAZIR.'
    : '\n⚠️  Doğrulama tam geçmedi — yukarıdaki ✗ maddeye bak.');
