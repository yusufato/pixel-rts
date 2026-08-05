// Turnuva eleme tasarimi: gurultu altinda "ilk 30'a kalma" ne kadar gercek?
// Olculen taban: mac marj std sapmasi 3114; kazanma olasiligi ~0.42-0.5 bandinda.

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function deney(nAday, nMac, gercekFarkStd, tohum) {
    const r = rng(tohum);
    // Her adayin GERCEK gucu: ortalama 0.5, std = gercekFarkStd (kazanma olasiligi cinsinden)
    const adaylar = [];
    for (let i = 0; i < nAday; i++) {
        // normal yaklasik (Box-Muller)
        const u1 = Math.max(1e-9, r()), u2 = r();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        adaylar.push({ i, gercek: Math.min(0.95, Math.max(0.05, 0.5 + z * gercekFarkStd)), galibiyet: 0 });
    }
    for (const a of adaylar) for (let m = 0; m < nMac; m++) if (r() < a.gercek) a.galibiyet++;
    const sirali = adaylar.slice().sort((a, b) => b.galibiyet - a.galibiyet || a.i - b.i);
    const secilen = sirali.slice(0, 30);
    // GERCEKTEN en iyi 30 kim?
    const gercekEnIyi = new Set(adaylar.slice().sort((a, b) => b.gercek - a.gercek).slice(0, 30).map(a => a.i));
    const isabet = secilen.filter(a => gercekEnIyi.has(a.i)).length;
    const secilenOrtGercek = secilen.reduce((s, a) => s + a.gercek, 0) / secilen.length;
    const tumOrtGercek = adaylar.reduce((s, a) => s + a.gercek, 0) / adaylar.length;
    const secilenOrtGozlenen = secilen.reduce((s, a) => s + a.galibiyet / nMac, 0) / secilen.length;
    return { isabet, secilenOrtGercek, tumOrtGercek, secilenOrtGozlenen };
}

function ortala(nAday, nMac, fark, tekrar) {
    let isabet = 0, gercek = 0, gozlenen = 0, taban = 0;
    for (let t = 0; t < tekrar; t++) {
        const d = deney(nAday, nMac, fark, 1000 + t * 7919);
        isabet += d.isabet; gercek += d.secilenOrtGercek; gozlenen += d.secilenOrtGozlenen; taban += d.tumOrtGercek;
    }
    return {
        isabet: (isabet / tekrar).toFixed(1),
        gercek: (gercek / tekrar).toFixed(3),
        gozlenen: (gozlenen / tekrar).toFixed(3),
        taban: (taban / tekrar).toFixed(3)
    };
}

console.log('100 ADAYDAN ILK 30 SECILIYOR — secilenlerin kaci GERCEKTEN ilk 30da?');
console.log('(30/30 = mukemmel secim, 9/30 = saf sans)\n');
console.log('senaryo'.padEnd(34) + 'isabet/30'.padStart(10) + '  secilen GERCEK'.padStart(16) + '  GOZLENEN'.padStart(11) + '  taban');

for (const [ad, fark] of [['adaylar OZDES (fark yok)', 0.0001], ['kucuk fark (std %3)', 0.03], ['orta fark (std %8)', 0.08], ['buyuk fark (std %15)', 0.15]]) {
    for (const nMac of [20, 40, 80]) {
        const d = ortala(100, nMac, fark, 400);
        console.log((ad + ', ' + nMac + ' mac').padEnd(34) + String(d.isabet).padStart(10) +
            String(d.gercek).padStart(16) + String(d.gozlenen).padStart(11) + '  ' + d.taban);
    }
}

console.log('\nNOT: "GOZLENEN" secilenlerin turnuvada gorunen kazanma orani,');
console.log('     "GERCEK" ise ayni adaylarin gercek gucu. Ikisi arasindaki fark = SANS PRIMI.');
