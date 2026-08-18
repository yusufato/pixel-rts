'use strict';
// KAPI BIRLESTIRME — bagimsiz (AYRI TOHUMLU) kapilari ters-varyans agirligiyla havuzlar.
//
// NEDEN GEREKLI: bu projede tek kapi neredeyse hep gucsuz (marj std ~2600-3400, aranan
// etki ~400). Iki kapi ayni tohumlari kullaniyorsa TOPLANAMAZ (gurultuleri korelasyonlu);
// AYRI tohumlu iseler havuzlanabilir ve saptama tabani sqrt(n) ile duser.
//
// KULLANIM (her kol: ort,std,n):
//   node tools/kapi-birlestir.js 486,3207,192 277,3415,192
const giris = process.argv.slice(2).filter(a => a.indexOf(',') > 0).map(a => {
    const [o, s, n] = a.split(',').map(Number);
    return { o, s, n, se: s / Math.sqrt(n) };
});
if (giris.length < 2) { console.log('en az iki kol ver: ort,std,n ort,std,n'); process.exit(1); }
let wSum = 0, wx = 0, nTop = 0, sVar = 0;
for (const g of giris) { const w = 1 / (g.se * g.se); wSum += w; wx += w * g.o; nTop += g.n; sVar += g.s * g.s * g.n; }
const ort = wx / wSum, se = Math.sqrt(1 / wSum), t = ort / se;
const stdOrt = Math.sqrt(sVar / nTop);
const taban = 2.8 * stdOrt / Math.sqrt(nTop);
console.log('BIRLESTIRILMIS (ters-varyans, ' + giris.length + ' bagimsiz kapi)');
for (const g of giris) console.log('  kol: ort ' + g.o + '  std ' + g.s + '  n ' + g.n + '  se ' + g.se.toFixed(1) + '  t ' + (g.o / g.se).toFixed(2));
console.log('  ── havuz: ort ' + ort.toFixed(0) + '   se ' + se.toFixed(0) + '   t ' + t.toFixed(2) + '   n ' + nTop);
console.log('  ── saptama tabani (bu n ile %80 guc): ±' + taban.toFixed(0) +
    (Math.abs(ort) >= taban ? '   → ETKI TABANIN USTUNDE' : '   → ETKI HALA TABANIN ALTINDA'));
const gerek = Math.ceil(Math.pow(2.8 * stdOrt / Math.abs(ort), 2));
console.log('  ── bu buyuklukteki etkiyi %80 gucle yakalamak icin gereken n: ' + gerek +
    '  (elde ' + nTop + ', eksik ' + Math.max(0, gerek - nTop) + ')');
