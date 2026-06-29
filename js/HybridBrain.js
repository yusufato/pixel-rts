// ═══════════════════════════════════════════════════════════════════════════
//  HybridBrain.js — HİBRİT AĞ (conv ALGI + skaler ÖZELLİK) · ileri-besleme (ES için)
//  ----------------------------------------------------------------------------
//  forward(scalars[240], spatial[8×16×16]) → çıktı[20].
//   • conv kolu: uzaysal harita (düşman/dost/yoğunluk/geçilebilir/orman/yükselti/CP/köprü)
//     → conv2d katmanları (ReLU) → düzleştir → gömme (embed). Battlefield GEOMETRİSİNİ görür.
//   • skaler kol: 240 el-işçiliği taktik özellik.
//   • birleşim: [skaler ⊕ embed] → MLP → 20 (posture7+menzil4+odak8+value1).
//  DETERMİNİST: yalnız +/× ve ReLU (exp/softmax YOK) → MP/headless bit-parite + ES uyumlu.
//  getWeights/setWeights: tüm parametreler tek düz Float64 (ES evrimi NeuralBrain ile aynı API).
// ═══════════════════════════════════════════════════════════════════════════
(function (global) {
    function convOut(inW, k, stride, pad) { return Math.floor((inW + 2 * pad - k) / stride) + 1; }

    // cfg: { scalarDim, spatial:[C,H,W], convs:[{out,k,stride,pad}], embed, mlp:[...], out }
    function HybridBrain(cfg, weights) {
        this.isHybrid = true;
        this.cfg = cfg;
        // katman boyutlarını çöz
        const sp = cfg.spatial; let C = sp[0], H = sp[1], W = sp[2];
        this.conv = [];
        for (const c of cfg.convs) {
            const pad = (c.pad != null) ? c.pad : (c.k >> 1), stride = c.stride || 1;
            const Ho = convOut(H, c.k, stride, pad), Wo = convOut(W, c.k, stride, pad);
            this.conv.push({ Cin: C, Cout: c.out, k: c.k, stride, pad, Hin: H, Win: W, Ho, Wo,
                wN: c.out * C * c.k * c.k, bN: c.out });
            C = c.out; H = Ho; W = Wo;
        }
        this.flat = C * H * W;                              // conv sonrası düzleştirme boyu
        // dense katman zinciri: embed (flat→embed) + [skaler⊕embed → mlp... → out]
        const dims = [];
        dims.push([this.flat, cfg.embed]);                 // embed
        let prev = cfg.scalarDim + cfg.embed;
        for (const h of cfg.mlp) { dims.push([prev, h]); prev = h; }
        dims.push([prev, cfg.out]);                        // çıktı (linear)
        this.dense = dims.map(d => ({ inD: d[0], outD: d[1], wN: d[0] * d[1], bN: d[1] }));
        // toplam parametre
        let n = 0;
        for (const l of this.conv) n += l.wN + l.bN;
        for (const l of this.dense) n += l.wN + l.bN;
        this.nParams = n;
        // çalışma tamponları
        this._sp = new Float64Array(cfg.spatial[0] * cfg.spatial[1] * cfg.spatial[2]);
        this.setWeights(weights || new Float64Array(this.nParams));
    }

    HybridBrain.prototype.setWeights = function (flat) {
        let o = 0;
        for (const l of this.conv) { l.W = flat.subarray ? flat.subarray(o, o + l.wN) : flat.slice(o, o + l.wN); o += l.wN; l.B = flat.subarray ? flat.subarray(o, o + l.bN) : flat.slice(o, o + l.bN); o += l.bN; }
        for (const l of this.dense) { l.W = flat.subarray ? flat.subarray(o, o + l.wN) : flat.slice(o, o + l.wN); o += l.wN; l.B = flat.subarray ? flat.subarray(o, o + l.bN) : flat.slice(o, o + l.bN); o += l.bN; }
        this._flat = flat;
    };
    HybridBrain.prototype.getWeights = function () {
        if (this._flat && this._flat.length === this.nParams) return this._flat;
        const out = new Float64Array(this.nParams); let o = 0;
        for (const l of this.conv) { out.set(l.W, o); o += l.wN; out.set(l.B, o); o += l.bN; }
        for (const l of this.dense) { out.set(l.W, o); o += l.wN; out.set(l.B, o); o += l.bN; }
        return out;
    };

    // conv2d: in[Cin*Hin*Win] (kanal-major) → out[Cout*Ho*Wo], ReLU. Sabit döngü sırası → determinist.
    function conv2d(inp, l) {
        const out = new Float64Array(l.Cout * l.Ho * l.Wo);
        const Hin = l.Hin, Win = l.Win, k = l.k, st = l.stride, pad = l.pad, Cin = l.Cin, W = l.W, B = l.B;
        for (let co = 0; co < l.Cout; co++) {
            const wco = co * Cin * k * k;
            for (let oy = 0; oy < l.Ho; oy++) {
                for (let ox = 0; ox < l.Wo; ox++) {
                    let s = B[co];
                    const iy0 = oy * st - pad, ix0 = ox * st - pad;
                    for (let ci = 0; ci < Cin; ci++) {
                        const inB = ci * Hin * Win, wB = wco + ci * k * k;
                        for (let ky = 0; ky < k; ky++) {
                            const iy = iy0 + ky; if (iy < 0 || iy >= Hin) continue;
                            const inR = inB + iy * Win, wR = wB + ky * k;
                            for (let kx = 0; kx < k; kx++) {
                                const ix = ix0 + kx; if (ix < 0 || ix >= Win) continue;
                                s += inp[inR + ix] * W[wR + kx];
                            }
                        }
                    }
                    out[co * l.Ho * l.Wo + oy * l.Wo + ox] = s > 0 ? s : 0;   // ReLU
                }
            }
        }
        return out;
    }

    HybridBrain.prototype.forward = function (scalars, spatial) {
        // conv kolu
        let cur = spatial;
        for (const l of this.conv) cur = conv2d(cur, l);   // cur = düzleştirilmiş aktivasyon (flat)
        // embed (dense[0]): flat → embed, ReLU
        const dl0 = this.dense[0]; const emb = new Float64Array(dl0.outD);
        for (let j = 0; j < dl0.outD; j++) { let s = dl0.B[j]; for (let i = 0; i < dl0.inD; i++) s += cur[i] * dl0.W[i * dl0.outD + j]; emb[j] = s > 0 ? s : 0; }
        // birleşim: [skaler ⊕ embed]
        const sd = this.cfg.scalarDim; let vec = new Float64Array(sd + dl0.outD);
        for (let i = 0; i < sd; i++) vec[i] = +scalars[i] || 0;
        for (let j = 0; j < dl0.outD; j++) vec[sd + j] = emb[j];
        // MLP (dense[1..]) — son katman linear
        for (let li = 1; li < this.dense.length; li++) {
            const l = this.dense[li], last = (li === this.dense.length - 1);
            const nx = new Float64Array(l.outD);
            for (let j = 0; j < l.outD; j++) { let s = l.B[j]; for (let i = 0; i < l.inD; i++) s += vec[i] * l.W[i * l.outD + j]; nx[j] = last ? s : (s > 0 ? s : 0); }
            vec = nx;
        }
        return vec;
    };
    HybridBrain.prototype.argmax = function (arr, lo, hi) { lo = lo || 0; hi = (hi == null ? arr.length : hi); let bi = lo, bv = arr[lo]; for (let i = lo + 1; i < hi; i++) if (arr[i] > bv) { bv = arr[i]; bi = i; } return bi; };
    HybridBrain.prototype.toJSON = function () { return { hybrid: true, cfg: this.cfg, weights: Array.from(this.getWeights()) }; };
    HybridBrain.fromJSON = function (o) { return new HybridBrain(o.cfg, Float64Array.from(o.weights)); };

    // VARSAYILAN MİMARİ (~130k): 8×16×16 → conv(16,3) → conv(32,3,s2) → conv(32,3,s2)=512 → embed96 ⊕ 240 → 160 → 64 → 20
    HybridBrain.defaultCfg = function (scalarDim, channels, grid) {
        return { scalarDim: scalarDim, spatial: [channels, grid, grid],
            convs: [{ out: 16, k: 3, stride: 1, pad: 1 }, { out: 32, k: 3, stride: 2, pad: 1 }, { out: 32, k: 3, stride: 2, pad: 1 }],
            embed: 96, mlp: [160, 64], out: 20 };
    };

    global.HybridBrain = HybridBrain;
    if (typeof module !== 'undefined' && module.exports) module.exports = HybridBrain;
})(typeof globalThis !== 'undefined' ? globalThis : this);
