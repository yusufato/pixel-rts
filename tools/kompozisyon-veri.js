// TURNUVA CIKTISINDAN VERI HASADI (GPU egitimi icin — EKSTRA CPU MALIYETI YOK)
// Turnuva zaten ~55.700 mac kosuyor ve her parca dosyasi mac-basi kayit tutuyor.
// Buradan (kompozisyon -> marj) veri seti cikarilir: kompozisyonu KOSMADAN tahmin eden bir
// vekil model, gelecekteki turnuvalari on-eleme ile cok daha ucuz yapabilir + hangi birim
// paylarinin marji surukledigini gosterir.
//
// X = tipPaylari vektoru (birim payi) + kategori paylari + tohum (kategorik offset)
// y = o macin marji  (NOT: mac-basi marj gurultusu std ~3114 -> tavan dusuk, raporda belirtilir)
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const PARCA = path.resolve(ROOT, arg('--parca', 'qa-runtime/caprazla-parca'));
const ADAYLAR = path.resolve(ROOT, arg('--adaylar', 'qa-runtime/adaylar-buyuk.json'));
const OUT = path.resolve(ROOT, arg('--out', 'qa-runtime/kompozisyon-veri.jsonl'));

const adaylar = JSON.parse(fs.readFileSync(ADAYLAR, 'utf8'));
const byAd = new Map(adaylar.map(a => [a.ad, a]));

// SABIT OZELLIK SIRASI: tum adaylardaki tipPaylari anahtarlarinin birlesimi (deterministik siralama)
const tipSet = new Set(), katSet = new Set();
for (const a of adaylar) {
    for (const k in (a.tipPaylari || {})) tipSet.add(k);
    for (const k in (a.paylar || {})) katSet.add(k);
}
const TIPLER = [...tipSet].sort(), KATLAR = [...katSet].sort();

function vektor(ad) {
    const a = byAd.get(ad);
    if (!a) return null;
    const tp = a.tipPaylari || {}, kp = a.paylar || {};
    const zor = a.zorunlu || {};
    return [
        ...TIPLER.map(k => tp[k] || 0),
        ...KATLAR.map(k => kp[k] || 0),
        ...TIPLER.map(k => (zor[k] ? 1 : 0))   // ZORUNLU birim bayragi (kor-nokta adaylari)
    ];
}

let dosya = 0, kayit = 0, atlanan = 0;
const cikti = [];
for (const f of fs.readdirSync(PARCA).filter(x => x.endsWith('.json'))) {
    let veri;
    try { veri = JSON.parse(fs.readFileSync(path.join(PARCA, f), 'utf8')); } catch { continue; }   // yazilirken yakalanmis olabilir
    dosya++;
    for (const hucre of veri) {
        const x = vektor(hucre.sal);
        if (!x) { atlanan++; continue; }
        for (const m of (hucre.maclar || [])) {
            if (m.marj == null) continue;
            cikti.push(JSON.stringify({ ad: hucre.sal, seed: m.seed, x, y: m.marj, kazandi: m.kazanan === 'sal' ? 1 : 0 }));
            kayit++;
        }
    }
}
fs.writeFileSync(OUT, cikti.join('\n') + (cikti.length ? '\n' : ''));
console.log('HASAT');
console.log('  parca dosyasi : ' + dosya);
console.log('  mac kaydi     : ' + kayit + (atlanan ? '   (atlanan hucre: ' + atlanan + ' - aday listesinde yok)' : ''));
console.log('  ozellik boyutu: ' + (TIPLER.length * 2 + KATLAR.length) + '   (' + TIPLER.length + ' tip payi + ' + KATLAR.length + ' kategori + ' + TIPLER.length + ' zorunlu-bayrak)');
console.log('  farkli aday   : ' + new Set(cikti.map(l => JSON.parse(l).ad)).size);
// OZELLIK ADLARI: egitim ciktisinin okunabilir olmasi icin (indeks -> ad)
const adlar = [...TIPLER.map(k => 'pay:' + k), ...KATLAR.map(k => 'kat:' + k), ...TIPLER.map(k => 'ZORUNLU:' + k)];
fs.writeFileSync(path.resolve(ROOT, 'qa-runtime/kompozisyon-ozellik-ad.json'), JSON.stringify(adlar));
console.log('-> ' + path.relative(ROOT, OUT));
