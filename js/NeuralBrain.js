// ── DETERMİNİSTİK KÜÇÜK SİNİR AĞI (MLP) — Aşama-2 öğrenen beyin çekirdeği ──
// Çıkarım SADECE + - * / max kullanır (ReLU gizli, linear çıktı, argmax aksiyon) → tarayıcı+Node BİT-TUTARLI (MP-güvenli).
// tanh/sigmoid/softmax/exp YOK (transcendental → motorlar-arası sapar). SABİT döngü-sırası (determinizm).
// Eğitim: ES ağırlık-vektörünü (getWeights/setWeights) evirir; oyun-içi: forward() → u.intent.
(function (global) {
  'use strict';

  function paramCount(sizes) {
    let n = 0;
    for (let i = 0; i < sizes.length - 1; i++) n += sizes[i] * sizes[i + 1] + sizes[i + 1];
    return n;
  }

  // sizes: [girdi, gizli1, gizli2, ..., çıktı]; weights: düz Float dizisi (yoksa sıfır)
  function NeuralBrain(sizes, weights) {
    this.sizes = sizes.slice();
    this.nParams = paramCount(sizes);
    this.W = []; this.B = [];
    this._buf = sizes.map((s) => new Float64Array(s));
    this.setWeights(weights || new Float64Array(this.nParams));
  }

  NeuralBrain.prototype.setWeights = function (flat) {
    this.W = []; this.B = [];
    let k = 0;
    for (let l = 0; l < this.sizes.length - 1; l++) {
      const inD = this.sizes[l], outD = this.sizes[l + 1];
      const w = new Float64Array(inD * outD);
      for (let i = 0; i < w.length; i++) w[i] = +flat[k++] || 0;
      const b = new Float64Array(outD);
      for (let i = 0; i < outD; i++) b[i] = +flat[k++] || 0;
      this.W.push(w); this.B.push(b);
    }
    return this;
  };

  NeuralBrain.prototype.getWeights = function () {
    const flat = new Float64Array(this.nParams);
    let k = 0;
    for (let l = 0; l < this.W.length; l++) {
      const w = this.W[l], b = this.B[l];
      for (let i = 0; i < w.length; i++) flat[k++] = w[i];
      for (let i = 0; i < b.length; i++) flat[k++] = b[i];
    }
    return flat;
  };

  // input: en az sizes[0] uzunluğunda dizi → çıktı katmanı (Float64Array, KOPYALANMAZ; hemen oku/argmax al)
  NeuralBrain.prototype.forward = function (input) {
    let cur = this._buf[0];
    for (let i = 0; i < cur.length; i++) cur[i] = +input[i] || 0;
    for (let l = 0; l < this.W.length; l++) {
      const inD = this.sizes[l], outD = this.sizes[l + 1], w = this.W[l], b = this.B[l], out = this._buf[l + 1];
      const last = (l === this.W.length - 1);
      for (let j = 0; j < outD; j++) {
        let s = b[j];
        for (let i = 0; i < inD; i++) s += cur[i] * w[i * outD + j];   // SABİT iç-çarpım sırası → determinizm
        out[j] = last ? s : (s > 0 ? s : 0);                          // ReLU (son katman linear)
      }
      cur = out;
    }
    return cur;
  };

  // [lo,hi) aralığında en büyük indeks (aksiyon-kafası seçimi; softmax-sampling YOK → deterministik)
  NeuralBrain.prototype.argmax = function (arr, lo, hi) {
    lo = lo || 0; hi = (hi == null ? arr.length : hi);
    let bi = lo, bv = arr[lo];
    for (let i = lo + 1; i < hi; i++) if (arr[i] > bv) { bv = arr[i]; bi = i; }
    return bi;
  };

  NeuralBrain.prototype.toJSON = function () { return { sizes: this.sizes, weights: Array.from(this.getWeights()) }; };
  NeuralBrain.fromJSON = function (o) { return new NeuralBrain(o.sizes, o.weights); };
  NeuralBrain.paramCount = paramCount;

  global.NeuralBrain = NeuralBrain;
  if (typeof module !== 'undefined' && module.exports) module.exports = NeuralBrain;
})(typeof globalThis !== 'undefined' ? globalThis : this);
