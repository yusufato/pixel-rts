// ═══════════════════════════════════════════════════════════════════════════
//  POLİTİKA AĞI — "bu durumda BU birim nereye gitmeli" (JS ileri-geçiş, kütüphanesiz)
//
//  NEDEN VAR: arama kanıtlanmış biçimde üstün (+1262 marj, n=96, t 4.3) ama ~1 CPU-sn /
//  oyun-sn harcıyor → canlı oyuna sığmıyor. Ucuzlatmanın DÖRT yolu da ölçüldü ve öldü
//  (1sn ufuk +33 · dönüşüm +191 · uzun periyot +153 · ışınlama vasat). Kazanç üç boyutun
//  ÇARPIMINDAN geliyor; hangisi kısılırsa kısılsın sıfırlanıyor.
//  AlphaZero'nun cevabı aramayı ucuzlatmak değil, POLİTİKAYA DAMITMAK: arama > politika
//  ise politikayı aramanın çıktısıyla eğit. Çıkarım tek ileri-geçiş — rollout yok.
//
//  ÖLÇÜLEN GEREKÇE (tools/politika-veri.js pilotu, 273 karar):
//    · rollout, ucuz eleyicinin #1 adayını kararların %62.6'sında DEVİRİYOR
//    · eleyici "yerinde kal"ı HİÇ birinci sıralamıyor (%0), oysa rollout %31 kal diyor
//  Yani öğrenilecek şey elde zaten olan ucuz skorun kopyası DEĞİL.
//
//  ÇIKTI UZAYI: 25 sınıf. 0 = yerinde kal, 1..24 = halka × yön (birime GÖRE).
//  Sınıf → nokta dönüşümü battleLookaheadSinifNokta() ile üreteç formülünün AYNISI.
//
//  MİMARİ (tools/politika-egit-gpu.py ile birebir aynı olmak ZORUNDA):
//    CNN   : Conv(8→32,3x3,pad1) ReLU → Conv(32→32,3x3,pad1) ReLU → AdaptiveAvgPool(3x4) → 384
//    MLP   : Linear(sdim→64) ReLU
//    Birim : Linear(bdim→32) ReLU
//    Baş   : Linear(480→128) ReLU → Linear(128→25)
//
//  ÖZNİTELİK TEK KAYNAKTAN: battleDurumOzellik() — eğitim verisini üreten
//  tools/politika-veri.js de AYNI fonksiyonu çağırır. İki kopya olsaydı en ufak sapma
//  ağı sessizce çöpe çevirirdi (değer ağında tam olarak bu yaşandı ve köprü kapısı yakaladı).
// ═══════════════════════════════════════════════════════════════════════════

let BATTLE_POLICY_NET_HAZIR = null;   // null=denenmedi, false=yok, true=kullanılabilir

function battlePolicyNetHazir() {
    if (BATTLE_POLICY_NET_HAZIR !== null) return BATTLE_POLICY_NET_HAZIR;
    BATTLE_POLICY_NET_HAZIR = !!(typeof BATTLE_POLICY_MODEL !== 'undefined' && BATTLE_POLICY_MODEL &&
        BATTLE_POLICY_MODEL.w && BATTLE_POLICY_MODEL.w['bas.2.bias'] &&
        typeof battleDurumOzellik === 'function');
    return BATTLE_POLICY_NET_HAZIR;
}

/* AdaptiveAvgPool2d(out) — PyTorch kutu sınırları: j'inci kutu
   [floor(j*i/o), ceil((j+1)*i/o)). 10→3 bölünmesi tam sayıya oturmadığı için
   formül birebir taklit edilmek ZORUNDA. */
function _bpnPoolSinir(i, o, j) {
    return [Math.floor(j * i / o), Math.ceil((j + 1) * i / o)];
}

/* BİRİM ÖZNİTELİĞİ — tools/politika-veri.js'teki kayıt bloğuyla BİREBİR aynı sıra
   ve ölçek olmak zorunda. Tek kaynak burasıdır; kayıt tarafı js/BattleLookahead.js
   içinde aynı formülü kullanır. */
function battlePolicyNetBirimOz(u) {
    if (!u) return null;
    const st = (typeof STATS !== 'undefined' && STATS[u.type]) ? STATS[u.type] : null;
    const yuv = (v) => Math.round(v * 1e4) / 1e4;
    return [u.x / WORLD_W, u.y / WORLD_H, u.type / 26,
            u.hp / Math.max(1, u.maxHp), u.isRed ? 1 : 0,
            (st && st.range ? st.range : 0) / 2000,
            (st && st.cost ? st.cost : 0) / 1000].map(yuv);
}

/* r: KANAL*GY*GX düz dizi, s: skaler dizi, b: birim özniteliği.
   Dönüş: 25 uzunluğunda logit dizisi (softmax UYGULANMAZ — argmax ve sıralama için
   gereksiz; olasılık isteyen çağıran kendisi normalize eder). */
function battlePolicyNetLogit(r, s, b) {
    if (!battlePolicyNetHazir()) return null;
    const M = BATTLE_POLICY_MODEL, W = M.w;
    const GX = M.gx, GY = M.gy, K = 8, SINIF = M.sinif;
    if (!r || r.length !== K * GY * GX || !s || s.length !== M.sdim || !b || b.length !== M.bdim) return null;

    // ── normalizasyon: raster KANAL BAŞINA (eleman başına DEĞİL) ──
    const rn = new Float32Array(K * GY * GX);
    for (let c = 0; c < K; c++) {
        const mu = M.rmu[c] || 0, sd0 = M.rsd[c];
        const sd = (sd0 === 0 || sd0 == null) ? 1 : sd0;
        const cb = c * GY * GX;
        for (let i = 0; i < GY * GX; i++) rn[cb + i] = (r[cb + i] - mu) / sd;
    }
    const sn = new Float32Array(M.sdim);
    for (let i = 0; i < M.sdim; i++) {
        const sd = M.ssd[i] || 1;
        sn[i] = (s[i] - M.smu[i]) / (sd === 0 ? 1 : sd);
    }
    const bn = new Float32Array(M.bdim);
    for (let i = 0; i < M.bdim; i++) {
        const sd = M.bsd[i] || 1;
        bn[i] = (b[i] - M.bmu[i]) / (sd === 0 ? 1 : sd);
    }

    // ── conv1: 8→32, 3x3, pad 1, ReLU ──
    const c1w = W['cnn.0.weight'].v, c1b = W['cnn.0.bias'].v;
    const h1 = new Float32Array(32 * GY * GX);
    for (let o = 0; o < 32; o++) {
        const ob = o * GY * GX;
        for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) {
            let acc = c1b[o];
            for (let c = 0; c < K; c++) {
                const wb = ((o * K + c) * 3) * 3;
                const cb = c * GY * GX;
                for (let ky = 0; ky < 3; ky++) {
                    const yy = y + ky - 1; if (yy < 0 || yy >= GY) continue;
                    for (let kx = 0; kx < 3; kx++) {
                        const xx = x + kx - 1; if (xx < 0 || xx >= GX) continue;
                        acc += rn[cb + yy * GX + xx] * c1w[wb + ky * 3 + kx];
                    }
                }
            }
            h1[ob + y * GX + x] = acc > 0 ? acc : 0;
        }
    }

    // ── conv2: 32→32, 3x3, pad 1, ReLU ──
    const c2w = W['cnn.2.weight'].v, c2b = W['cnn.2.bias'].v;
    const h2 = new Float32Array(32 * GY * GX);
    for (let o = 0; o < 32; o++) {
        const ob = o * GY * GX;
        for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) {
            let acc = c2b[o];
            for (let c = 0; c < 32; c++) {
                const wb = ((o * 32 + c) * 3) * 3;
                const cb = c * GY * GX;
                for (let ky = 0; ky < 3; ky++) {
                    const yy = y + ky - 1; if (yy < 0 || yy >= GY) continue;
                    for (let kx = 0; kx < 3; kx++) {
                        const xx = x + kx - 1; if (xx < 0 || xx >= GX) continue;
                        acc += h1[cb + yy * GX + xx] * c2w[wb + ky * 3 + kx];
                    }
                }
            }
            h2[ob + y * GX + x] = acc > 0 ? acc : 0;
        }
    }

    // ── AdaptiveAvgPool2d((3,4)) → 32*3*4 = 384 ──
    const pooled = new Float32Array(384);
    for (let c = 0; c < 32; c++) {
        const cb = c * GY * GX;
        for (let py = 0; py < 3; py++) {
            const ys = _bpnPoolSinir(GY, 3, py);
            for (let px = 0; px < 4; px++) {
                const xs = _bpnPoolSinir(GX, 4, px);
                let sum = 0, n = 0;
                for (let y = ys[0]; y < ys[1]; y++) for (let x = xs[0]; x < xs[1]; x++) { sum += h2[cb + y * GX + x]; n++; }
                pooled[c * 12 + py * 4 + px] = n ? sum / n : 0;
            }
        }
    }

    // ── skaler MLP: Linear(sdim→64) ReLU ──
    const mw = W['mlp.0.weight'].v, mb = W['mlp.0.bias'].v;
    const mo = new Float32Array(64);
    for (let o = 0; o < 64; o++) {
        let acc = mb[o];
        const wb = o * M.sdim;
        for (let i = 0; i < M.sdim; i++) acc += sn[i] * mw[wb + i];
        mo[o] = acc > 0 ? acc : 0;
    }

    // ── birim MLP: Linear(bdim→32) ReLU ──
    const bw = W['bir.0.weight'].v, bb = W['bir.0.bias'].v;
    const bo = new Float32Array(32);
    for (let o = 0; o < 32; o++) {
        let acc = bb[o];
        const wb = o * M.bdim;
        for (let i = 0; i < M.bdim; i++) acc += bn[i] * bw[wb + i];
        bo[o] = acc > 0 ? acc : 0;
    }

    // ── Baş: Linear(480→128) ReLU → Linear(128→SINIF) ──
    const GIRIS = 384 + 64 + 32;
    const cat = new Float32Array(GIRIS);
    cat.set(pooled, 0); cat.set(mo, 384); cat.set(bo, 448);
    const h3w = W['bas.0.weight'].v, h3b = W['bas.0.bias'].v;
    const h3 = new Float32Array(128);
    for (let o = 0; o < 128; o++) {
        let acc = h3b[o];
        const wb = o * GIRIS;
        for (let i = 0; i < GIRIS; i++) acc += cat[i] * h3w[wb + i];
        h3[o] = acc > 0 ? acc : 0;
    }
    const o4w = W['bas.2.weight'].v, o4b = W['bas.2.bias'].v;
    const out = new Float32Array(SINIF);
    for (let o = 0; o < SINIF; o++) {
        let acc = o4b[o];
        const wb = o * 128;
        for (let i = 0; i < 128; i++) acc += h3[i] * o4w[wb + i];
        out[o] = acc;
    }
    return out;
}

/* MEVCUT SİM DURUMUNDAN bir birim için sınıf sıralaması.
   Dönüş: logit dizisi ya da null. */
function battlePolicyNetBirim(u) {
    if (!battlePolicyNetHazir() || !u) return null;
    const oz = battleDurumOzellik(BATTLE_POLICY_MODEL.gx, BATTLE_POLICY_MODEL.gy);
    if (!oz) return null;
    const b = battlePolicyNetBirimOz(u);
    if (!b) return null;
    return battlePolicyNetLogit(oz.r, oz.s, b);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { battlePolicyNetLogit, battlePolicyNetBirim, battlePolicyNetHazir,
        battlePolicyNetBirimOz };
}
