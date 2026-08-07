// CANLI MAC ANALIZI — kullanici 4 AI'ya karsi AYNI tohumla (202) oynadi.
//
// SORULAR:
//   (1) Kim kazandi, mac ne zaman belirlendi (marj yorungesi)
//   (2) BLOB HIPOTEZI: beonai gruplarini tek sektore mi topluyor? (headless olcumde 25sn'de
//       FIXING/FLANK/MAIN'in ucu de "center" cikmisti; kod-AI sol/sag/merkez'e yayiliyordu)
//       Olcu: AI birimlerinin ortalama ikili mesafesi (dagilim) ve sektor histogram entropisi.
//   (3) Takas verimi: her taraf ne kadar deger imha etti / kaybetti
//   (4) Oyuncunun oynayisi maclar arasi ne kadar tutarli (kiyas adil mi)
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const DIZIN = arg('--dizin', 'C:/Users/osman/Downloads');
const ONEK = arg('--onek', 'pixel-rts-ham-savas-kaydi-202-');

const dosyalar = fs.readdirSync(DIZIN).filter(f => f.startsWith(ONEK) && f.endsWith('.json')).sort();
if (!dosyalar.length) { console.error('dosya yok: ' + DIZIN + '/' + ONEK + '*'); process.exit(1); }

function entropi(pay) {
    const top = pay.reduce((a, b) => a + b, 0);
    if (!top) return 0;
    let h = 0;
    for (const v of pay) { const p = v / top; if (p > 0) h -= p * Math.log2(p); }
    return h;
}

const rapor = [];
for (const f of dosyalar) {
    const d = JSON.parse(fs.readFileSync(path.join(DIZIN, f), 'utf8'));
    const t = d.replay && d.replay.telemetry;
    if (!t || !t.samples) { console.log('  ! ' + f + ' telemetri yok'); continue; }
    const beyin = t.rakipBeyin || '(etiketsiz)';
    const S = t.samples;
    // birim alan adlarini ilk ornekten cikar (surumler arasi ad degisebilir)
    // TELEMETRI BICIMI (dogrulandi): side='red'|'blue' (STRING), owner='ENEMY_AI'|'PLAYER'.
    // Olu birimler listeden DUSER (dead alani yok).
    const kx = 'x', ky = 'y', kHp = 'hp';

    const zaman = [];
    for (const s of S) {
        if (!s.units) continue;
        const kirmizi = [], mavi = [];
        for (const u of s.units) (u.side === 'red' ? kirmizi : mavi).push(u);
        // dagilim: ortalama ikili mesafe (blob = dusuk)
        const dagilim = (arr) => {
            if (arr.length < 2) return 0;
            let top = 0, n = 0;
            for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
                top += Math.hypot(arr[i][kx] - arr[j][kx], arr[i][ky] - arr[j][ky]); n++;
            }
            return n ? top / n : 0;
        };
        // sektor histogrami (3 dikey serit) -> entropi (blob = dusuk entropi)
        const serit = (arr) => {
            const b = [0, 0, 0];
            for (const u of arr) { const i = u[kx] < 1700 ? 0 : (u[kx] > 3400 ? 2 : 1); b[i]++; }
            return b;
        };
        zaman.push({
            sn: Math.round(s.seconds != null ? s.seconds : s.tick * 0.05),
            kSay: kirmizi.length, mSay: mavi.length,
            kDagilim: Math.round(dagilim(kirmizi)), mDagilim: Math.round(dagilim(mavi)),
            kEntropi: +entropi(serit(kirmizi)).toFixed(2),
            kHp: Math.round(kirmizi.reduce((a, u) => a + (u.hp || 0), 0)),
            mHp: Math.round(mavi.reduce((a, u) => a + (u.hp || 0), 0)),
            // MORAL/BASKI: topcunun urunu — hangi AI oyuncuyu daha cok bastiriyor?
            mBaski: mavi.length ? +(mavi.reduce((a, u) => a + (u.suppression || 0), 0) / mavi.length).toFixed(1) : 0,
            mPanik: mavi.length ? +(mavi.reduce((a, u) => a + (u.panic || 0), 0) / mavi.length).toFixed(1) : 0,
            mKacan: mavi.filter(u => u.fleeing).length,
            kBaski: kirmizi.length ? +(kirmizi.reduce((a, u) => a + (u.suppression || 0), 0) / kirmizi.length).toFixed(1) : 0,
            kKacan: kirmizi.filter(u => u.fleeing).length,
            kKuru: kirmizi.filter(u => (u.maxAmmo || 0) > 0 && (u.ammo || 0) <= 0).length,
            kSiper: kirmizi.filter(u => u.inTrench).length,
        });
    }
    const son = t.finalSummary || {};
    rapor.push({ dosya: f, beyin, zaman, son, olay: (t.combatEvents || []).length,
        yasam: (t.lifeEvents || []).length, kararlar: (t.controllerDecisions || []).length });
}

rapor.sort((a, b) => ['intel3-pro', 'intel4', 'intel4-pro', 'beonai'].indexOf(a.beyin) -
                     ['intel3-pro', 'intel4', 'intel4-pro', 'beonai'].indexOf(b.beyin));

console.log('CANLI MAC ANALIZI — ' + rapor.length + ' mac, tohum 202, oyuncu = MAVI');
console.log('');
console.log('  ' + 'rakip AI'.padEnd(13) + 'sure'.padStart(7) + 'kirmiziKalan'.padStart(14) +
    'maviKalan'.padStart(11) + '  sonuc'.padStart(10) + '  olay'.padStart(8));
for (const r of rapor) {
    const z = r.zaman[r.zaman.length - 1] || {};
    const kazanan = r.son.winnerSide === true ? 'KIRMIZI' : (r.son.winnerSide === false ? 'MAVI (sen)' : '-');
    console.log('  ' + r.beyin.padEnd(13) + ((z.sn || 0) + 'sn').padStart(7) +
        (z.kSay + ' birim').padStart(14) + (z.mSay + ' birim').padStart(11) +
        kazanan.padStart(10) + String(r.olay).padStart(8));
}

console.log('');
console.log('  BLOB TESTI — KIRMIZI (AI) birimlerinin YAYILIMI. Dusuk = blob.');
console.log('  ' + 'rakip AI'.padEnd(13) + '30sn'.padStart(8) + '60sn'.padStart(8) + '90sn'.padStart(8) +
    '120sn'.padStart(8) + '180sn'.padStart(8) + '   ort.entropi (0=tek serit, 1.58=esit)');
for (const r of rapor) {
    const at = (sn) => { const z = r.zaman.find(x => x.sn >= sn); return z ? z.kDagilim : null; };
    const eOrt = r.zaman.length ? (r.zaman.reduce((a, z) => a + z.kEntropi, 0) / r.zaman.length) : 0;
    console.log('  ' + r.beyin.padEnd(13) +
        [30, 60, 90, 120, 180].map(s => { const v = at(s); return (v == null ? '-' : v + 'px').padStart(8); }).join('') +
        ('   ' + eOrt.toFixed(2)).padStart(12));
}

console.log('');
console.log('  KUVVET (HP toplami) ZAMAN ICINDE — kirmizi / mavi');
console.log('  ' + 'rakip AI'.padEnd(13) + [30, 60, 90, 120, 180, 240].map(s => (s + 'sn').padStart(13)).join(''));
for (const r of rapor) {
    const at = (sn) => { const z = r.zaman.find(x => x.sn >= sn); return z ? (z.kHp + '/' + z.mHp) : '-'; };
    console.log('  ' + r.beyin.padEnd(13) + [30, 60, 90, 120, 180, 240].map(s => at(s).padStart(13)).join(''));
}

console.log('');
console.log('  AI OYUNCUYU NE KADAR BASTIRIYOR (mavi ort. baski / panik / kacan) — topcunun urunu');
console.log('  ' + 'rakip AI'.padEnd(13) + [30, 60, 90, 120].map(s => (s + 'sn').padStart(17)).join(''));
for (const r of rapor) {
    const at = (sn) => { const z = r.zaman.find(x => x.sn >= sn); return z ? (z.mBaski + '/' + z.mPanik + '/' + z.mKacan) : '-'; };
    console.log('  ' + r.beyin.padEnd(13) + [30, 60, 90, 120].map(s => at(s).padStart(17)).join(''));
}
console.log('');
console.log('  AI KENDI DURUMU (kirmizi ort.baski / kacan / KURU / siperde)');
console.log('  ' + 'rakip AI'.padEnd(13) + [30, 60, 90, 120].map(s => (s + 'sn').padStart(19)).join(''));
for (const r of rapor) {
    const at = (sn) => { const z = r.zaman.find(x => x.sn >= sn); return z ? (z.kBaski + '/' + z.kKacan + '/' + z.kKuru + '/' + z.kSiper) : '-'; };
    console.log('  ' + r.beyin.padEnd(13) + [30, 60, 90, 120].map(s => at(s).padStart(19)).join(''));
}
console.log('');
console.log('  BIRIM SAYISI ZAMAN ICINDE — kirmizi / mavi (oyuncunun tutarliligi da burada gorulur)');
console.log('  ' + 'rakip AI'.padEnd(13) + [0, 30, 60, 90, 120, 180, 240].map(s => (s + 'sn').padStart(10)).join(''));
for (const r of rapor) {
    const at = (sn) => { const z = r.zaman.find(x => x.sn >= sn); return z ? (z.kSay + '/' + z.mSay) : '-'; };
    console.log('  ' + r.beyin.padEnd(13) + [0, 30, 60, 90, 120, 180, 240].map(s => at(s).padStart(10)).join(''));
}
