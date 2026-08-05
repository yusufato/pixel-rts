// ERKEN SINYAL SONUCU NE KADAR TAHMIN EDIYOR?
// Her macta erken marj (t=120sn) ve NIHAI marj kayitli. Eger erken sinyal nihai
// sonucu iyi tahmin ediyorsa, TARAMA turlari KISA maclarla kosulabilir -> ayni
// butceyle cok daha fazla aday elenebilir. (Nihai karar yine tam macla verilir.)
const fs = require('fs');
const path = require('path');

const dosyalar = fs.readdirSync('qa-runtime').filter(f => /\.json$/.test(f));
const ciftler = [];
for (const f of dosyalar) {
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join('qa-runtime', f), 'utf8')); } catch (e) { continue; }
    const hucreler = Array.isArray(j) ? j : (j.hucreler || []);
    if (!Array.isArray(hucreler)) continue;
    for (const h of hucreler) {
        if (!h || !Array.isArray(h.maclar)) continue;
        for (const m of h.maclar) {
            if (!m || !m.erken || typeof m.marj !== 'number') continue;
            const e = m.erken.sal - m.erken.sav;
            ciftler.push({ erken: e, son: m.marj, kazanan: m.kazanan, bitis: m.bitisSn });
        }
    }
}
// tekrarlari at (ayni mac birden cok dosyada olabilir)
const gorulen = new Set();
const veri = ciftler.filter(c => {
    const k = c.erken + '|' + c.son + '|' + c.bitis;
    if (gorulen.has(k)) return false;
    gorulen.add(k); return true;
});

if (!veri.length) { console.log('erken/son cifti bulunamadi'); process.exit(0); }

const ort = a => a.reduce((s, x) => s + x, 0) / a.length;
const E = veri.map(v => v.erken), S = veri.map(v => v.son);
const mE = ort(E), mS = ort(S);
let cov = 0, vE = 0, vS = 0;
for (let i = 0; i < veri.length; i++) { cov += (E[i] - mE) * (S[i] - mS); vE += (E[i] - mE) ** 2; vS += (S[i] - mS) ** 2; }
const r = cov / Math.sqrt(vE * vS);

// isaret uyumu: erken onde olan sonunda da kazandi mi
const isaretUyum = veri.filter(v => (v.erken > 0) === (v.kazanan === 'sal')).length / veri.length;
// buyuk erken fark daha mi guvenilir?
const bant = (alt, ust) => {
    const k = veri.filter(v => Math.abs(v.erken) >= alt && Math.abs(v.erken) < ust);
    if (!k.length) return null;
    return { n: k.length, uyum: k.filter(v => (v.erken > 0) === (v.kazanan === 'sal')).length / k.length };
};

console.log('ERKEN SINYAL (t=120sn) -> NIHAI SONUC   n=' + veri.length + ' mac');
console.log('  korelasyon (erken marj, nihai marj) : r = ' + r.toFixed(3));
console.log('  isaret uyumu (erken onde = kazanan) : %' + (isaretUyum * 100).toFixed(0));
console.log('');
console.log('  erken farkin BUYUKLUGUNE gore guvenilirlik:');
for (const [a, b] of [[0, 500], [500, 1500], [1500, 3000], [3000, 1e9]]) {
    const x = bant(a, b);
    if (x) console.log('    |erken| ' + String(a).padStart(4) + '-' + (b > 1e8 ? '+' : String(b)).padEnd(5) +
        '  n=' + String(x.n).padStart(4) + '   dogru tahmin %' + (x.uyum * 100).toFixed(0));
}
const bitisler = veri.map(v => v.bitis).filter(Number.isFinite).sort((a, b) => a - b);
if (bitisler.length) {
    const yuzde = p => bitisler[Math.floor(bitisler.length * p)];
    console.log('');
    console.log('  mac bitis suresi: medyan ' + yuzde(0.5) + 'sn, %25 ' + yuzde(0.25) + 'sn, %75 ' + yuzde(0.75) + 'sn');
    console.log('  360sn tam suren mac orani: %' + Math.round(bitisler.filter(x => x >= 355).length / bitisler.length * 100));
}
