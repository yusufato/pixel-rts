// ═══════════════════════════════════════════════════════════════════════════
//  DEĞER AĞI — durumdan NİHAİ marjı tahmin eder (JS ileri-geçiş, kütüphanesiz)
//
//  NEDEN VAR: aramanın hedefi kararsızdı. ÖLÇÜLDÜ (tools/gelecek-yelpazesi.js):
//  10sn'de en iyi çıkan aday 20sn'de kazancın yalnız %13'ünü koruyor. Yani
//  argmax(marj@10sn) kalıcı üstünlük değil GEÇİCİ TAKAS seçiyor — ve bu, beş null
//  A/B sonucunu tek başına açıklıyor.
//  Elle yazılmış sekiz ölçü adayı da denendi (tools/hedef-kararliligi.js): hiçbiri
//  global marjı geçemedi, en iyisi bile kazancın %48'inde kaldı.
//  Bu ağ o boşluğu doldurur: 10 saniyelik pencereyi değil NİHAİ sonucu tahmin eder.
//
//  ÖLÇÜLEN (tools/durum-egit-gpu.py, 81.074 görüntü / 1600 maç, maç-bazlı bölme):
//    Spearman 0.840 · işaret doğruluğu %87
//    zamana göre: 0-30sn 0.389 · 30-70sn 0.701 · 70-120sn 0.887 · 200sn+ 0.959
//  Yani erken oyunda belirsizlik GERÇEK; orta-geç oyunda tahmin neredeyse kesin.
//
//  MİMARİ (tools/durum-egit-gpu.py ile birebir aynı olmak ZORUNDA):
//    CNN : Conv(8→32,3x3,pad1) ReLU → Conv(32→32,3x3,pad1) ReLU → AdaptiveAvgPool(3x4) → 384
//    MLP : Linear(59→64) ReLU
//    Baş : Linear(448→128) ReLU → Linear(128→1)     ~73k parametre
//
//  ÖZNİTELİK TEK KAYNAKTAN: girdi js/BattleStateFeatures.js'teki battleDurumOzellik()
//  ile üretilir — eğitim verisini üreten tools/durum-veri.js de AYNI fonksiyonu çağırır.
//  İki kopya olsaydı en ufak sapma ağı sessizce çöpe çevirirdi.
// ═══════════════════════════════════════════════════════════════════════════

let BATTLE_VALUE_NET_HAZIR = null;   // null=denenmedi, false=yok, true=kullanılabilir

function battleValueNetHazir() {
    if (BATTLE_VALUE_NET_HAZIR !== null) return BATTLE_VALUE_NET_HAZIR;
    BATTLE_VALUE_NET_HAZIR = !!(typeof BATTLE_VALUE_MODEL !== 'undefined' && BATTLE_VALUE_MODEL &&
        BATTLE_VALUE_MODEL.w && BATTLE_VALUE_MODEL.w['bas.2.bias'] &&
        typeof battleDurumOzellik === 'function');
    return BATTLE_VALUE_NET_HAZIR;
}

/* AdaptiveAvgPool2d(out) — PyTorch'un kutu sınırları:
   j'inci kutu [floor(j*i/o), ceil((j+1)*i/o)). 10→3 ve 16→4 için bu bölünme
   TAM SAYIYA oturmuyor (10/3), o yüzden formül birebir taklit edilmeli. */
function _bvnPoolSinir(i, o, j) {
    return [Math.floor(j * i / o), Math.ceil((j + 1) * i / o)];
}

/* r: KANAL*GY*GX düz dizi (battleDurumOzellik çıktısı), s: skaler dizi.
   Dönüş: tahmini NİHAİ marj (kırmızı − mavi, ₺). */
function battleValueNetTahmin(r, s) {
    if (!battleValueNetHazir()) return null;
    const M = BATTLE_VALUE_MODEL, W = M.w;
    const GX = M.gx, GY = M.gy, K = 8;
    if (!r || r.length !== K * GY * GX || !s || s.length !== M.sdim) return null;

    /* ── normalizasyon ──
       RASTER KANAL BAŞINA normalize edilir, eleman başına DEĞİL:
       eğitimde `R.mean((0,2,3))` — yani parti, yükseklik ve genişlik üzerinden
       ortalama alınıyor, geriye 8 kanal değeri kalıyor.
       İlk sürümde 1280 elemanın her birine ayrı ortalama uyguladım; doğrulama
       (Python ↔ JS karşılaştırması) bunu hemen yakaladı — dizi boyu 8'di, 1280 değil.
       Düz dizi düzeni kanal-öncelikli: r[c*GY*GX + y*GX + x] (bkz. BattleStateFeatures). */
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
            const [y0, y1] = _bvnPoolSinir(GY, 3, py);
            for (let px = 0; px < 4; px++) {
                const [x0, x1] = _bvnPoolSinir(GX, 4, px);
                let sum = 0, n = 0;
                for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { sum += h2[cb + y * GX + x]; n++; }
                pooled[c * 12 + py * 4 + px] = n ? sum / n : 0;
            }
        }
    }

    // ── MLP: Linear(sdim→64) ReLU ──
    const mw = W['mlp.0.weight'].v, mb = W['mlp.0.bias'].v;
    const mo = new Float32Array(64);
    for (let o = 0; o < 64; o++) {
        let acc = mb[o];
        const wb = o * M.sdim;
        for (let i = 0; i < M.sdim; i++) acc += sn[i] * mw[wb + i];
        mo[o] = acc > 0 ? acc : 0;
    }

    // ── Baş: Linear(448→128) ReLU → Linear(128→1) ──
    const cat = new Float32Array(448);
    cat.set(pooled, 0); cat.set(mo, 384);
    const h3w = W['bas.0.weight'].v, h3b = W['bas.0.bias'].v;
    const h3 = new Float32Array(128);
    for (let o = 0; o < 128; o++) {
        let acc = h3b[o];
        const wb = o * 448;
        for (let i = 0; i < 448; i++) acc += cat[i] * h3w[wb + i];
        h3[o] = acc > 0 ? acc : 0;
    }
    const o4w = W['bas.2.weight'].v, o4b = W['bas.2.bias'].v;
    let out = o4b[0];
    for (let i = 0; i < 128; i++) out += h3[i] * o4w[i];

    return out * M.ys;   // eğitimde hedef ys'ye bölünmüştü
}

/* MEVCUT SİM DURUMUNDAN tahmin. Arama bunu çağırır. */
function battleValueNetDurum() {
    if (!battleValueNetHazir()) return null;
    const oz = battleDurumOzellik(BATTLE_VALUE_MODEL.gx, BATTLE_VALUE_MODEL.gy);
    if (!oz) return null;
    return battleValueNetTahmin(oz.r, oz.s);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { battleValueNetTahmin, battleValueNetDurum, battleValueNetHazir };
}
