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
//  ── GÖREV: 25 SINIF DEĞİL, 3 SEÇENEK ──
//  Arama adayları ucuz skora göre sıralar ve YALNIZ ilk ikisini (LA_DERIN=2) artı
//  "yerinde kal"ı oynatır. Nihai seçim tanım gereği bu üçünden biri:
//      0 = eleyici #1'i onayla · 1 = eleyici #2'ye dön · 2 = yerinde kal
//  Ölçüldü (9853 karar): %43.6 / %30.7 / %25.7 — toplam tam %100, küme kapalı.
//
//  ⚠ İLK SÜRÜM ÖLÇÜLEREK ÇÖPE ATILDI: (durum, birim) → "hangi kafes sınıfı" kurgusu
//  öğrenilemezdi, çünkü ağın girdisinde SEÇENEKLERİN KENDİSİ yoktu — #1 ile #2'nin
//  nerede olduğu ya da ucuz skorun onları nasıl puanladığı hiç geçmiyordu. Sonuç:
//  tahminlerin %94'ü tek seçeneğe yığıldı (bedava "hep #1" tabanına çökme).
//  Bu sürümde her seçenek KENDİ özniteliğiyle girdiye girer.
//
//  MİMARİ (tools/politika-egit-gpu.py ile birebir aynı olmak ZORUNDA):
//    CNN   : Conv(8→32,3x3,pad1) ReLU → Conv(32→32,3x3,pad1) ReLU → AdaptiveAvgPool(3x4) → 384
//    MLP   : Linear(sdim→64) ReLU
//    Birim : Linear(bdim→32) ReLU
//    Baş   : Linear(480+cdim→128) ReLU → Linear(128→1)  — HER SEÇENEK İÇİN AYRI ÇAĞRILIR
//  Bağlam (CNN+MLP+Birim) bir kez hesaplanır, üç seçenekte paylaşılır.
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

/* SEÇENEK ÖZNİTELİĞİ — tools/politika-egit-gpu.py'deki `C` bloğuyla BİREBİR aynı
   sıra ve türetme olmak ZORUNDA:
     [sıra, kal?, analitik, ağ, analitik−#1, ağ−#1, dx, dy]

   `sıra` HAM İNDİS (0,1,2) — i/(n−1) DEĞİL. Seçenek sayısı 2 de olabilir 3 de
   ("yerinde kal" zaten ilk ikideyse üçüncü eklenmez; ölçüldü: kararların %9.6'sı).
   Normalize edilseydi aynı "ikinci sıra" iki farklı sayıya düşer, model seçenek
   sayısından bağımsız olamazdı. Eğitimde de ham indis kullanılır ve eksik seçenek
   MASKELENİR; burada zaten yalnız var olan seçenekler puanlanır — eşdeğeri.

   `sec`: her biri {sinif, _s, _ag, x, y} taşıyan, aramanın oynattığı sıradaki liste.
   Dönüş: SEC×CDIM düz dizi. */
function battlePolicyNetSecenekOz(u, sec) {
    if (!u || !sec || !sec.length) return null;
    const M = BATTLE_POLICY_MODEL;
    const n = sec.length, cd = M.cdim;
    const yuv = (v) => Math.round(v * 1e4) / 1e4;   // kayıt tarafıyla aynı yuvarlama
    const ana0 = yuv(sec[0]._s == null ? 0 : sec[0]._s);
    const ag0 = yuv(sec[0]._ag == null ? 0 : sec[0]._ag);
    const out = new Float32Array(n * cd);
    for (let i = 0; i < n; i++) {
        const a = sec[i];
        const ana = yuv(a._s == null ? 0 : a._s), ag = yuv(a._ag == null ? 0 : a._ag);
        const f = [i, (a.sinif | 0) === 0 ? 1 : 0,
                   ana, ag, ana - ana0, ag - ag0,
                   yuv((a.x - u.x) / LA_YARICAP), yuv((a.y - u.y) / LA_YARICAP)];
        for (let j = 0; j < cd; j++) out[i * cd + j] = f[j];
    }
    return out;
}

/* r: KANAL*GY*GX düz dizi, s: skaler dizi, b: birim özniteliği,
   c: SEC×cdim seçenek özniteliği (battlePolicyNetSecenekOz çıktısı).
   Dönüş: SEC uzunluğunda logit dizisi (softmax UYGULANMAZ — argmax için gereksiz). */
function battlePolicyNetLogit(r, s, b, c) {
    if (!battlePolicyNetHazir()) return null;
    const M = BATTLE_POLICY_MODEL, W = M.w;
    const GX = M.gx, GY = M.gy, K = 8, CDIM = M.cdim;
    if (!r || r.length !== K * GY * GX || !s || s.length !== M.sdim || !b || b.length !== M.bdim) return null;
    if (!c || c.length % CDIM !== 0) return null;
    const SEC = c.length / CDIM;

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
    /* Seçenek özniteliği: eğitimde istatistikler (0,1) eksenlerinde alındı — yani
       seçenek ekseni boyunca da ortalandı. Üç seçenek AYNI ölçeğe oturmalı. */
    const cn = new Float32Array(c.length);
    for (let i = 0; i < SEC; i++) for (let j = 0; j < CDIM; j++) {
        const sd = M.csd[j] || 1;
        cn[i * CDIM + j] = (c[i * CDIM + j] - M.cmu[j]) / (sd === 0 ? 1 : sd);
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

    /* ── Baş: Linear(480+cdim→128) ReLU → Linear(128→1), HER SEÇENEK İÇİN ──
       Bağlam (pooled+mo+bo) üç seçenekte ORTAK; yalnız son cdim alan değişir.
       Bu yüzden bağlamın katkısı bir kez toplanır, seçenek başına yalnız cdim
       çarpım eklenir — üç kez 480 çarpım yapmak saf israf olurdu. */
    const BAGLAM = 384 + 64 + 32;
    const cat = new Float32Array(BAGLAM);
    cat.set(pooled, 0); cat.set(mo, 384); cat.set(bo, 448);
    const h3w = W['bas.0.weight'].v, h3b = W['bas.0.bias'].v;
    const GIRIS = BAGLAM + CDIM;
    const taban = new Float32Array(128);
    for (let o = 0; o < 128; o++) {
        let acc = h3b[o];
        const wb = o * GIRIS;
        for (let i = 0; i < BAGLAM; i++) acc += cat[i] * h3w[wb + i];
        taban[o] = acc;
    }
    const o4w = W['bas.2.weight'].v, o4b = W['bas.2.bias'].v;
    const out = new Float32Array(SEC);
    const h3 = new Float32Array(128);
    for (let k = 0; k < SEC; k++) {
        for (let o = 0; o < 128; o++) {
            let acc = taban[o];
            const wb = o * GIRIS + BAGLAM;
            for (let j = 0; j < CDIM; j++) acc += cn[k * CDIM + j] * h3w[wb + j];
            h3[o] = acc > 0 ? acc : 0;
        }
        let acc = o4b[0];
        for (let i = 0; i < 128; i++) acc += h3[i] * o4w[i];
        out[k] = acc;
    }
    return out;
}

/* MEVCUT SİM DURUMUNDAN bir birim + seçenek listesi için logitler.
   `oz` dışarıdan verilir: bir arama turunda durum DEĞİŞMEZ, rasteri birim başına
   yeniden üretmek işin en pahalı parçasını N'e katlardı. */
function battlePolicyNetBirim(u, sec, oz) {
    if (!battlePolicyNetHazir() || !u || !sec || !sec.length) return null;
    const _oz = oz || battleDurumOzellik(BATTLE_POLICY_MODEL.gx, BATTLE_POLICY_MODEL.gy);
    if (!_oz) return null;
    const b = battlePolicyNetBirimOz(u);
    const c = battlePolicyNetSecenekOz(u, sec);
    if (!b || !c) return null;
    return battlePolicyNetLogit(_oz.r, _oz.s, b, c);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { battlePolicyNetLogit, battlePolicyNetBirim, battlePolicyNetHazir,
        battlePolicyNetBirimOz, battlePolicyNetSecenekOz };
}
