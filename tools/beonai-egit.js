'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  beonai EĞİTİM — oracle etiketli veriden seçici model üretir
//
//  Girdi : tools/beonai-uret.js'in JSONL çıktısı (karar başına listwise tuple)
//  Çıktı : js/BattleBeonaiModels.js — sürüm kaydına yazılan model + künye
//
//  ÜÇ FİLTRE (hepsi gerekli, sessizce uygulanmaz — RAPORLANIR):
//   1) `aktif` olmayan kararlar ATILIR. Temas yoksa tüm adayların ödülü aynı çıkıyor
//      (ölçüldü: 64 adayın 64'ü de −3172.6) → sinyal yok, model gürültü ezberler.
//   2) Ödül varyansı sıfır olan kararlar ATILIR (aynı sebep, sayısal kontrol).
//   3) Sürüm uyuşmazlığı (stateFeatures/candidateFeatures) olan kayıtlar ATILIR.
//
//  DOĞRULAMA: veri KARAR bazında eğitim/geliştirme diye ayrılır (aynı maçın kararları
//  aynı tarafa düşer → sızıntı yok). Rapor: dev üzerinde oracle-seçme isabeti ve
//  ortalama regret. Bunlar MAÇ SONUCU DEĞİLDİR — gerçek karar caprazla ile çok-tohumlu
//  değerlendirmede verilir (docs/OLCUM-KRIZI-TOHUM-SAYISI.md).
//
//  Kullanım:
//    node tools/beonai-egit.js --veri qa-runtime/beonai-veri.jsonl --surum beonai-v1
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
function arg(ad, vars) { const i = process.argv.indexOf(ad); return i >= 0 ? process.argv[i + 1] : vars; }

const VERI = arg('--veri', 'qa-runtime/beonai-veri.jsonl');
const SURUM = arg('--surum', 'beonai-v1');
const EPOK = Math.max(1, Number(arg('--epok', 300)) || 300);
const LR = Number(arg('--lr', 0.02)) || 0.02;
const H = Math.max(4, Number(arg('--h', 48)) || 48);
const DEV_ORAN = Math.min(0.5, Math.max(0.05, Number(arg('--dev', 0.2)) || 0.2));
const CIKTI = arg('--out', 'js/BattleBeonaiModels.js');

// BattleSelector saf JS ve tarayıcı-global tarzı yazılmış → vm ile yükleyip fonksiyonları al.
function selectorYukle() {
    const vm = require('node:vm');
    const kod = fs.readFileSync(path.join(ROOT, 'js/BattleSelector.js'), 'utf8');
    const sandbox = { module: { exports: {} }, console, Math, JSON, Array, Object, Number, isNaN, isFinite };
    sandbox.exports = sandbox.module.exports;
    vm.createContext(sandbox);
    vm.runInContext(kod, sandbox, { filename: 'BattleSelector.js' });
    return sandbox.module.exports;
}

function main() {
    const sel = selectorYukle();
    if (typeof sel.selTrain !== 'function') { console.log('selTrain yok — BattleSelector yüklenemedi'); process.exit(1); }

    const yol = path.join(ROOT, VERI);
    if (!fs.existsSync(yol)) { console.log('veri yok: ' + VERI + '  (önce tools/beonai-uret.js koşun)'); process.exit(1); }
    const satirlar = fs.readFileSync(yol, 'utf8').split('\n').filter(Boolean);

    const ornekler = [];
    const elenen = { aktifDegil: 0, varyansSifir: 0, surumUyusmaz: 0, bozuk: 0 };
    let sVer = null, cVer = null;
    for (const s of satirlar) {
        let o; try { o = JSON.parse(s); } catch (e) { elenen.bozuk++; continue; }
        const v = o.veri;
        if (!v || !v.stateFeatures || !Array.isArray(v.rows) || !v.rows.length) { elenen.bozuk++; continue; }
        if (sVer == null) { sVer = v.stateVersion; cVer = v.candidateVersion; }
        if (v.stateVersion !== sVer || v.candidateVersion !== cVer) { elenen.surumUyusmaz++; continue; }
        if (o.aktif === false || v.active === false) { elenen.aktifDegil++; continue; }
        const od = v.rows.map(r => r.reward);
        const ort = od.reduce((a, b) => a + b, 0) / od.length;
        const vary = od.reduce((a, b) => a + (b - ort) * (b - ort), 0) / od.length;
        if (!(vary > 0)) { elenen.varyansSifir++; continue; }
        ornekler.push({ stateFeatures: v.stateFeatures, rows: v.rows, tick: o.tick, seed: o.seed });
    }

    console.log('beonai EĞİTİM');
    console.log('  veri     : ' + VERI + '  (' + satirlar.length + ' karar kaydı)');
    console.log('  kullanılan: ' + ornekler.length + '   ELENEN → aktif değil ' + elenen.aktifDegil +
        ', varyans sıfır ' + elenen.varyansSifir + ', sürüm uyuşmaz ' + elenen.surumUyusmaz + ', bozuk ' + elenen.bozuk);
    if (!ornekler.length) { console.log('EĞİTİLECEK ÖRNEK YOK — daha çok/temaslı veri üretin.'); process.exit(1); }

    // KARAR bazında ayır; aynı tohumun kararları aynı tarafa gitsin (sızıntı yok)
    const tohumlar = [...new Set(ornekler.map(o => o.seed))].sort((a, b) => a - b);
    const devTohumSayisi = Math.max(1, Math.round(tohumlar.length * DEV_ORAN));
    const devTohum = new Set(tohumlar.slice(-devTohumSayisi));
    const egitim = ornekler.filter(o => !devTohum.has(o.seed));
    const dev = ornekler.filter(o => devTohum.has(o.seed));
    console.log('  bölme    : ' + egitim.length + ' eğitim / ' + dev.length + ' dev' +
        '  (dev tohumları: ' + [...devTohum].join(',') + ')');
    if (!egitim.length) { console.log('EĞİTİM KÜMESİ BOŞ — daha çok tohumdan veri üretin.'); process.exit(1); }

    const t0 = Date.now();
    // DİKKAT: selTrain { model, loss } SARMALAYICISI döndürür. Sarmalayıcıyı model sanıp
    // kaydedersek model.D undefined olur, selForward NaN üretir ve canlı seçici hiçbir adayı
    // seçemez. (Ölçüldü: "64/64 aday geçersiz skor aldı, model D=undefined".)
    const egitimSonuc = sel.selTrain(egitim, { epochs: EPOK, lr: LR, H, seed: 12345 });
    const model = (egitimSonuc && egitimSonuc.model) ? egitimSonuc.model : egitimSonuc;
    if (!model || !Number.isFinite(model.D)) { console.log('EĞİTİM ÇIKTISI GEÇERSİZ (model.D yok) — durduruldu.'); process.exit(1); }
    const sure = ((Date.now() - t0) / 1000).toFixed(1);

    const olc = (kume) => {
        if (!kume.length || typeof sel.selEvaluate !== 'function') return null;
        try { return sel.selEvaluate(model, kume); } catch (e) { return { hata: e.message }; }
    };
    const egitimSkor = olc(egitim), devSkor = olc(dev);
    console.log('  eğitim   : ' + EPOK + ' epok, H=' + H + ', lr=' + LR + '  (' + sure + 'sn)');
    console.log('  eğitim skoru: ' + JSON.stringify(egitimSkor));
    console.log('  DEV skoru   : ' + JSON.stringify(devSkor));
    console.log('  NOT: bu skorlar KARAR seçme isabetidir, MAÇ SONUCU DEĞİL.');
    console.log('       Gerçek karar: node tools/caprazla.js ... (çok tohumlu, dışörneklem)');

    // MOTOR SÜRÜMÜ künyeye EĞİTİM ANINDA yazılır. BattleBeonai bunu çalışma anındaki
    // BATTLE_ENGINE_VERSION ile karşılaştırır; uyuşmazsa model BAYAT sayılır ve bağlanmaz.
    // (Repoda daha önce tam bu yüzden bir model sessizce dağılım-dışı kalmıştı.)
    let motorSurumu = null;
    try {
        const bs = fs.readFileSync(path.join(ROOT, 'js/BattleSession.js'), 'utf8');
        const m = /BATTLE_ENGINE_VERSION\s*=\s*'([^']+)'/.exec(bs);
        if (m) motorSurumu = m[1];
    } catch (e) {}
    if (!motorSurumu) console.log('  ! UYARI: motor sürümü okunamadı — bayatlık koruması bu sürümde ÇALIŞMAZ');

    const kunye = {
        surum: SURUM, uretildi: 'beonai-egit', motorSurumu,
        veriKaydi: satirlar.length, kullanilan: ornekler.length, elenen,
        egitim: egitim.length, dev: dev.length, devTohumlari: [...devTohum],
        epok: EPOK, lr: LR, H, egitimSkor, devSkor
    };
    const govde = '// OTOMATİK ÜRETİM — tools/beonai-egit.js. ELLE DÜZENLEME.\n' +
        '// beonai sürüm kaydı: BattleBeonai.js bunları okur; motor sürümü uyuşmazsa BAYAT sayılır.\n' +
        'const BATTLE_BEONAI_MODEL_' + SURUM.replace(/[^A-Za-z0-9]/g, '_').toUpperCase() + ' = ' + JSON.stringify(model) + ';\n' +
        'const BATTLE_BEONAI_KUNYE_' + SURUM.replace(/[^A-Za-z0-9]/g, '_').toUpperCase() + ' = ' + JSON.stringify(kunye) + ';\n' +
        'if (typeof battleBeonaiKaydet === "function") battleBeonaiKaydet(' + JSON.stringify(SURUM) +
        ', BATTLE_BEONAI_MODEL_' + SURUM.replace(/[^A-Za-z0-9]/g, '_').toUpperCase() +
        ', BATTLE_BEONAI_KUNYE_' + SURUM.replace(/[^A-Za-z0-9]/g, '_').toUpperCase() + ');\n' +
        'if (typeof module !== "undefined" && module.exports) module.exports = { model: BATTLE_BEONAI_MODEL_' +
        SURUM.replace(/[^A-Za-z0-9]/g, '_').toUpperCase() + ', kunye: BATTLE_BEONAI_KUNYE_' +
        SURUM.replace(/[^A-Za-z0-9]/g, '_').toUpperCase() + ' };\n';
    fs.writeFileSync(path.join(ROOT, CIKTI), govde);
    console.log('');
    console.log('BEONAI_EGIT_OK  sürüm ' + SURUM + '  -> ' + CIKTI);
}

if (require.main === module) main();
