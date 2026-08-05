// Profil dosyasini oku, fonksiyon bazinda ornek payini raporla.
const fs = require('fs');
const path = require('path');
const dir = 'qa-runtime/prof';
const f = fs.readdirSync(dir).filter(x => x.endsWith('.cpuprofile'))[0];
if (!f) { console.log('profil yok'); process.exit(1); }
const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const byId = {};
for (const n of p.nodes) byId[n.id] = n;
const say = {};
for (const s of p.samples) say[s] = (say[s] || 0) + 1;
const toplam = p.samples.length;
const b = {};
for (const [id, c] of Object.entries(say)) {
    const n = byId[id];
    const cf = (n && n.callFrame) || {};
    const k = cf.functionName || '(anon)';
    b[k] = (b[k] || 0) + c;
}
const karsilastir = process.argv[2] ? JSON.parse(process.argv[2]) : null;
if (karsilastir) {
    console.log('FONKSIYON'.padEnd(26) + 'ONCE'.padStart(7) + 'SONRA'.padStart(8) + '   fark');
    for (const [k, v] of Object.entries(karsilastir)) {
        const simdi = (b[k] || 0) / toplam * 100;
        const d = simdi - v;
        console.log(k.padEnd(26) + ('%' + v.toFixed(1)).padStart(7) + ('%' + simdi.toFixed(1)).padStart(8) +
            '   ' + (d >= 0 ? '+' : '') + d.toFixed(1));
    }
} else {
    console.log('ornek ' + toplam);
    Object.entries(b).sort((x, y) => y[1] - x[1]).slice(0, 18)
        .forEach(([k, c]) => console.log('  %' + (c / toplam * 100).toFixed(1).padStart(5) + '  ' + k));
}
