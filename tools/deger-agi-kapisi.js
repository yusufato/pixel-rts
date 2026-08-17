'use strict';
// DEGER AGI KAPISI — JS ileri-gecisi Python egitimiyle AYNI seyi mi hesapliyor?
//
// NEDEN: model PyTorch'ta egitilip JS'e elle tasindi. En ufak sapma (normalizasyon
// bicimi, kanal sirasi, pooling sinirlari) agi SESSIZCE cope cevirir - tahmin uretmeye
// devam eder ama anlamsizdir. Nitekim ilk surumde raster normalizasyonunu ELEMAN BASINA
// yapmistim; egitimde KANAL BASINA idi. Karsilastirma bunu ilk denemede yakaladi.
//
// OLCUT: JS tahminleri ile gercek nihai marj arasindaki Spearman, egitimde olculen
// rho'ya yakin olmali. Veri yoksa kapi ATLANIR (qa-runtime gitignore'da).
//
//   node tools/deger-agi-kapisi.js [--veri "qa-runtime/durum/veri-*.jsonl"] [--n 3000]
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const glob = require('glob');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const DESEN = arg('--veri', 'qa-runtime/durum/veri-*.jsonl');
const N = Math.max(50, Number(arg('--n', 3000)) || 3000);

let dosyalar = [];
try { dosyalar = glob.sync(DESEN); } catch (e) { dosyalar = []; }
if (!dosyalar.length) {
    // glob yoksa elle tara
    const dir = DESEN.replace(/[^/]*$/, '');
    try { dosyalar = fs.readdirSync(dir).filter(f => /veri-\d+\.jsonl$/.test(f)).map(f => dir + f); } catch (e) {}
}
if (!dosyalar.length) { console.log('DEGERAGI_ATLANDI (veri yok: ' + DESEN + ')'); process.exit(0); }

const veri = [];
for (const d of dosyalar) {
    const satir = fs.readFileSync(d, 'utf8').split('\n');
    const adim = Math.max(1, Math.floor(satir.length / (N / dosyalar.length)));
    for (let i = 0; i < satir.length && veri.length < N; i += adim) {
        const l = satir[i]; if (!l || !l.trim()) continue;
        try { const j = JSON.parse(l); if (j.r && j.s && j.y != null) veri.push({ r: j.r, s: j.s, y: j.y }); } catch (e) {}
    }
    if (veri.length >= N) break;
}
if (veri.length < 50) { console.log('DEGERAGI_ATLANDI (yeterli ornek yok)'); process.exit(0); }

const { ctx, hatalar } = tezgahKur();
if (hatalar.length) { console.log('TEZGAH HATASI: ' + hatalar.join(' | ')); process.exit(1); }
ctx.__ORNEK = veri.map(v => ({ r: v.r, s: v.s }));
const r = JSON.parse(vm.runInContext(
    '(() => { if (!battleValueNetHazir()) return JSON.stringify({hazir:false});' +
    ' const o=[]; for (const x of __ORNEK) o.push(battleValueNetTahmin(x.r, x.s));' +
    ' return JSON.stringify({hazir:true, tahmin:o}); })()', ctx, { filename: 'dk' }));

if (!r.hazir) { console.log('DEGERAGI_PROBLEM: model yuklenemedi (js/BattleValueModel.js)'); process.exit(1); }
const bosSayi = r.tahmin.filter(x => x === null || !isFinite(x)).length;
if (bosSayi) { console.log('DEGERAGI_PROBLEM: ' + bosSayi + ' tahmin NULL/NaN'); process.exit(1); }

const sira = a => { const s = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const rk = new Array(a.length);
    for (let i = 0; i < s.length; i++) rk[s[i][1]] = i; return rk; };
const A = sira(r.tahmin), B = sira(veri.map(v => v.y));
const n = A.length;
const ma = (n - 1) / 2;
let num = 0, da = 0, db = 0;
for (let i = 0; i < n; i++) { const x = A[i] - ma, y = B[i] - ma; num += x * y; da += x * x; db += y * y; }
const rho = num / Math.sqrt(da * db);
const isaret = r.tahmin.filter((t, i) => (t > 0) === (veri[i].y > 0)).length / n;

console.log('DEGER AGI KAPISI — ' + n + ' ornek');
console.log('  JS tahmini <-> gercek nihai marj:  Spearman ' + rho.toFixed(3) + '   isaret %' + (isaret * 100).toFixed(0));
console.log('  (egitimde olculen: rho 0.840 / isaret %87)');
if (rho < 0.70) { console.log('DEGERAGI_PROBLEM: rho cok dusuk - JS ileri-gecisi egitimle AYNI DEGIL'); process.exit(1); }
console.log('DEGERAGI_OK');
