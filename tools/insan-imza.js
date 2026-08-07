// INSAN OYUN IMZASI — "insan ne yapiyor da AI yapmiyor?"
//
// NEDEN: FAZ 0 olctu ki beonai AI rakibe karsi SORUNSUZ (yayilim 823px, oz baski 3.7) ama
// INSANA karsi cokuyor (240px, 87.6). Egitim verisi tamamen AI-vs-AI. Demek ki insanin oyunu
// egitim dagiliminin DISINDA. Bu arac o farki SAYIYA cevirir — tahminle degil kayitla.
//
// Veri: kullanicinin oynadigi 4 ham telemetri (ayni tohum 202, dort farkli rakip AI).
// Kiyas: ayni maclarda KIRMIZI (AI) tarafinin ayni metrikleri.
//
// OLCULENLER (hepsi 0.5sn'lik ornekten):
//   YAYILIM        : birimler arasi ort. ikili mesafe
//   YEREL YOGUNLUK : 600px cemberdeki en kalabalik birim sayisi
//   ODAK ATESI     : ayni dusmani hedefleyen birim sayisinin tepesi (attackTargetId histogrami)
//   HAREKET        : hareket eden birim orani + ort. hiz
//   ILERI/GERI     : kutle merkezinin dusman hattina gore konumu
//   BASKI UYGULAMA : karsi tarafin ort. baskisi (kim daha cok bastiriyor)
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const DIZIN = arg('--dizin', 'C:/Users/osman/Downloads');
const ONEK = arg('--onek', 'pixel-rts-ham-savas-kaydi-202-');

const dosyalar = fs.readdirSync(DIZIN).filter(f => f.startsWith(ONEK) && f.endsWith('.json')).sort();
if (!dosyalar.length) { console.error('dosya yok'); process.exit(1); }

function olc(birimler) {
    if (birimler.length < 2) return null;
    let t = 0, c = 0, maxY = 0;
    for (let i = 0; i < birimler.length; i++) {
        let yakin = 0;
        for (let j = 0; j < birimler.length; j++) {
            if (i === j) continue;
            const d = Math.hypot(birimler[i].x - birimler[j].x, birimler[i].y - birimler[j].y);
            if (j > i) { t += d; c++; }
            if (d <= 600) yakin++;
        }
        if (yakin + 1 > maxY) maxY = yakin + 1;
    }
    // ODAK ATESI: ayni hedefe kilitlenen birim sayisinin TEPESI
    const hedef = {};
    for (const u of birimler) { const h = u.attackTargetId; if (h) hedef[h] = (hedef[h] || 0) + 1; }
    const odakTepe = Object.keys(hedef).length ? Math.max.apply(null, Object.values(hedef)) : 0;
    const atesEden = Object.values(hedef).reduce((a, b) => a + b, 0);
    const hareket = birimler.filter(u => u.isMovingToManualTarget || u.movingToManualTarget).length;
    let cx = 0, cy = 0;
    for (const u of birimler) { cx += u.x; cy += u.y; }
    return {
        yayilim: c ? t / c : 0, yogunluk: maxY, odakTepe,
        odakOran: atesEden ? odakTepe / atesEden : 0,
        hareketOran: birimler.length ? hareket / birimler.length : 0,
        cx: cx / birimler.length, cy: cy / birimler.length,
        baski: birimler.reduce((a, u) => a + (u.suppression || 0), 0) / birimler.length,
        siperde: birimler.filter(u => u.inTrench).length / birimler.length,
    };
}

const rapor = [];
for (const f of dosyalar) {
    const d = JSON.parse(fs.readFileSync(path.join(DIZIN, f), 'utf8'));
    const t = d.replay && d.replay.telemetry;
    if (!t || !t.samples) continue;
    const beyin = t.rakipBeyin || '(etiketsiz)';
    const T = { insan: {}, ai: {}, n: 0 };
    const ekle = (hedef, o) => {
        if (!o) return;
        for (const k of ['yayilim', 'yogunluk', 'odakTepe', 'odakOran', 'hareketOran', 'baski', 'siperde'])
            hedef[k] = (hedef[k] || 0) + o[k];
    };
    for (const s of t.samples) {
        if (!s.units) continue;
        const mavi = s.units.filter(u => u.side !== 'red');
        const kirmizi = s.units.filter(u => u.side === 'red');
        const om = olc(mavi), ok = olc(kirmizi);
        if (!om || !ok) continue;
        ekle(T.insan, om); ekle(T.ai, ok); T.n++;
    }
    rapor.push({ beyin, T });
}
rapor.sort((a, b) => ['intel3-pro', 'intel4', 'intel4-pro', 'beonai'].indexOf(a.beyin) -
                     ['intel3-pro', 'intel4', 'intel4-pro', 'beonai'].indexOf(b.beyin));

const O = (x, k, n) => (n ? x[k] / n : 0);
console.log('INSAN OYUN IMZASI — ' + rapor.length + ' mac (tohum 202). MAVI = insan, KIRMIZI = AI.');
console.log('');
console.log('  ' + 'rakip AI'.padEnd(12) + 'taraf'.padEnd(8) + 'yayilim'.padStart(9) +
    '600px-yog'.padStart(11) + 'ODAK tepe'.padStart(11) + 'odak-oran'.padStart(11) +
    'hareket%'.padStart(10) + 'oz baski'.padStart(10) + 'siperde%'.padStart(10));
for (const r of rapor) {
    for (const [ad, x] of [['INSAN', r.T.insan], ['AI', r.T.ai]]) {
        console.log('  ' + (ad === 'INSAN' ? r.beyin : '').padEnd(12) + ad.padEnd(8) +
            Math.round(O(x, 'yayilim', r.T.n) || 0).toString().padStart(9) +
            (O(x, 'yogunluk', r.T.n) || 0).toFixed(1).padStart(11) +
            (O(x, 'odakTepe', r.T.n) || 0).toFixed(1).padStart(11) +
            ('%' + Math.round((O(x, 'odakOran', r.T.n) || 0) * 100)).padStart(11) +
            ('%' + Math.round((O(x, 'hareketOran', r.T.n) || 0) * 100)).padStart(10) +
            (O(x, 'baski', r.T.n) || 0).toFixed(1).padStart(10) +
            ('%' + Math.round((O(x, 'siperde', r.T.n) || 0) * 100)).padStart(10));
    }
}
console.log('');
console.log('  OKUMA: "ODAK tepe" = ayni dusmani hedefleyen birim sayisinin tepesi (konsantre ates).');
console.log('         Insan ile AI arasindaki en buyuk fark hangi sutunda ise, egitim dagiliminda');
console.log('         eksik olan sey odur — probe rakip once o davranisi taklit etmeli.');
