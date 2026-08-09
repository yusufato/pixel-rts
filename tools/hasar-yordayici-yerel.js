// HASARI NE YORDAR — YEREL DUZEY (ordu toplami DEGIL, temas bolgesi basina)
//
// ONCEKI BULGU (tools/hasar-yordayici.js, 29 kayit / 221 pencere): ORDU DUZEYINDE hicbir toplam
// buyukluk hasari yordamiyor — en iyisi 0.246 (dolayli-ates sayisi), AI'in kendi forceRatio'su 0.160,
// Lanchester 0.078. Sorun formulde degil SOYUTLAMA DUZEYINDE: hasar YEREL bir olay (o an kim kimin
// menzilinde), orduyu tek sayiya indirince sinyal yok oluyor.
//
// BU ARAC ayni sinavi YEREL yapar: harita HUCRELERE bolunur, her (hucre, pencere) icin taraf-basi
// oznitelikler ve o hucrede INEN hasar olculur. combatEvents konumlu (targetX/targetY) -> etiket kesin.
//
// KIYAS: ayni satirda KURESEL deger orani da tutulur. Yerel olcut kureseli belirgin geciyorsa,
// angajman karari GLOBAL forceRatio yerine YEREL olcute baglanmali demektir.
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const DIZIN = arg('--dizin', 'C:/Users/osman/Downloads');
const ONEK = arg('--onek', 'pixel-rts-ham-savas-kaydi-');
const PENCERE = Number(arg('--pencere', 10)) || 10;      // sn — yerelde daha kisa pencere anlamli
const HUCRE = Number(arg('--hucre', 1000)) || 1000;      // px
const KENAR = Number(arg('--kenar', 600)) || 600;        // hucreye komsu birimleri de say (menzil payi)

const _db = require(path.join(__dirname, '..', 'js', 'UnitData.js'));
const _U = (_db && (_db.UNITS_MODERN_DB || _db.UNITS_MODERN || _db)) || {};
global.UNITS_MODERN_DB = _U;
const _L = (Array.isArray(_U.units) ? _U.units : Object.values(_U)).filter(x => x && x.id);
const ST = {};
_L.forEach((u, i) => {
    let mx = 0, ind = false;
    for (const w of (u.weapons || [])) { if ((w.range || 0) > mx) mx = w.range; if (w.indirect) ind = true; }
    ST[i] = { id: u.id, armorType: u.armorType, weapons: u.weapons || [], cost: (u.cost && u.cost.resource) || 0, menzil: mx, dolayli: ind };
});
const F = require(path.join(__dirname, '..', 'js', 'BattleForecast.js'));

const ADAYLAR = {
    'YEREL deger orani':          { tip: 'oran', f: (us) => us.reduce((a, u) => a + (ST[u.type].cost || 0) * (u.hp / Math.max(1, u.maxHp)), 0) },
    'YEREL birim sayisi':         { tip: 'oran', f: (us) => us.length },
    'YEREL can':                  { tip: 'oran', f: (us) => us.reduce((a, u) => a + u.hp, 0) },
    'YEREL Lanchester D':         { tip: 'oran', ozel: 'lanchester' },
    'YEREL menzil-agirlikli':     { tip: 'oran', f: (us) => us.reduce((a, u) => a + (ST[u.type].cost || 0) * (u.hp / Math.max(1, u.maxHp)) * (ST[u.type].menzil || 0), 0) },
    'YEREL dolayli sayisi':       { tip: 'fark', f: (us) => us.filter(u => ST[u.type].dolayli).length },
    'YEREL ates edebilen':        { tip: 'fark', f: (us) => us.filter(u => u.attackTargetId).length },   // SOZLESME: 0 = hedef YOK (eski `!= null` tum birimleri sayiyordu)
    'YEREL baski (ters)':         { tip: 'fark', f: (us) => us.length ? -us.reduce((a, u) => a + (u.suppression || 0), 0) / us.length : 0 },
    'YEREL menzilimde dusman':    { tip: 'fark', alan: 'menzilimdeDusman', f: (us) => us.reduce((a, u) => a + (u.menzilimdeDusman || 0), 0) },
    'YEREL net maruziyet':        { tip: 'fark', alan: 'netMaruziyet', f: (us) => us.reduce((a, u) => a + (u.netMaruziyet || 0), 0) },
    'KURESEL deger orani (kiyas)': { tip: 'oran', ozel: 'kuresel' }
};

let dosyalar = fs.readdirSync(DIZIN).filter(f => f.startsWith(ONEK) && f.endsWith('.json')).sort();
if (!dosyalar.length) { console.error('kayit bulunamadi'); process.exit(1); }

const veri = {}, hedefBasi = {};
for (const ad of Object.keys(ADAYLAR)) { veri[ad] = []; hedefBasi[ad] = []; }
let satirSayisi = 0, hucreSayisi = 0;

for (const dos of dosyalar) {
    const d = JSON.parse(fs.readFileSync(path.join(DIZIN, dos), 'utf8'));
    const t = (d.replay || {}).telemetry || {};
    const sm = t.samples || [], ce = t.combatEvents || [];
    if (!sm.length || !ce.length) continue;
    const aiKirmizi = (t.rakipTaraf || 'kirmizi') !== 'mavi';
    const A_SIDE = aiKirmizi ? 'blue' : 'red', B_SIDE = aiKirmizi ? 'red' : 'blue';
    const adim = Math.max(1, Math.round(PENCERE / 0.5));

    for (let i = 0; i + adim < sm.length; i += adim) {
        const s = sm[i], t0 = s.seconds, t1 = sm[i + adim].seconds;
        const canli = (s.units || []).filter(u => u.hp > 0);
        if (!canli.length) continue;
        // KURESEL kiyas degeri (ayni pencerede sabit)
        const kdeger = (side) => canli.filter(u => u.side === side).reduce((a, u) => a + (ST[u.type].cost || 0) * (u.hp / Math.max(1, u.maxHp)), 0);
        const KA = kdeger(A_SIDE), KB = kdeger(B_SIDE);

        // pencerede inen hasari HUCREYE yaz (targetX/targetY = hasarin indigi yer)
        const hucreHasar = new Map();
        for (const e of ce) {
            if (e.seconds < t0 || e.seconds >= t1) continue;
            if (!Number.isFinite(e.targetX)) continue;
            const cx = Math.floor(e.targetX / HUCRE), cy = Math.floor(e.targetY / HUCRE);
            const k = cx + ':' + cy;
            if (!hucreHasar.has(k)) hucreHasar.set(k, { A: 0, B: 0 });
            const h = hucreHasar.get(k);
            if (e.attackerSide === A_SIDE) h.A += (e.damage || 0); else h.B += (e.damage || 0);
        }

        for (const [k, h] of hucreHasar) {
            hucreSayisi++;
            if (h.A <= 0 || h.B <= 0 || (h.A + h.B) < 50) continue;   // iki taraf da vurmus olmali
            const [cx, cy] = k.split(':').map(Number);
            const x0 = cx * HUCRE - KENAR, x1 = (cx + 1) * HUCRE + KENAR;
            const y0 = cy * HUCRE - KENAR, y1 = (cy + 1) * HUCRE + KENAR;
            const ic = canli.filter(u => u.x >= x0 && u.x < x1 && u.y >= y0 && u.y < y1);
            const uA = ic.filter(u => u.side === A_SIDE), uB = ic.filter(u => u.side === B_SIDE);
            if (!uA.length || !uB.length) continue;

            const y = Math.log(h.A / h.B);
            const mp = (us) => us.map(u => ({ stats: ST[u.type], hp: u.hp, maxHp: u.maxHp }));
            for (const [ad, spec] of Object.entries(ADAYLAR)) {
                if (spec.alan && !ic.some(u => u[spec.alan] !== undefined)) continue;
                let a, b;
                if (spec.ozel === 'lanchester') { a = F.forecastArmyAggregate(mp(uA), mp(uB)).D; b = F.forecastArmyAggregate(mp(uB), mp(uA)).D; }
                else if (spec.ozel === 'kuresel') { a = KA; b = KB; }
                else { a = spec.f(uA); b = spec.f(uB); }
                let v;
                if (spec.tip === 'oran') { if (!(a > 0) || !(b > 0)) continue; v = Math.log(a / b); }
                else v = a - b;
                if (!Number.isFinite(v)) continue;
                veri[ad].push(v); hedefBasi[ad].push(y);
            }
            satirSayisi++;
        }
    }
}

const ort = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
function korel(xs, ys) {
    const n = Math.min(xs.length, ys.length); if (n < 3) return NaN;
    const mx = ort(xs), my = ort(ys);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
    return (sxx > 0 && syy > 0) ? sxy / Math.sqrt(sxx * syy) : NaN;
}

console.log('HASARI NE YORDAR — YEREL (' + dosyalar.length + ' kayit, hucre ' + HUCRE + 'px +' + KENAR + 'px kenar, pencere ' + PENCERE + 'sn)');
console.log('  ' + hucreSayisi + ' hucre-pencere tarandi, ' + satirSayisi + ' tanesi iki-tarafli catisma');
console.log('  hedef: log(A hasari / B hasari) O HUCREDE.  A = INSAN, B = AI.');
console.log('');
console.log('  ' + 'yordayici'.padEnd(30) + 'korelasyon'.padStart(12) + 'ornek'.padStart(7) + '   yorum');
const sat = Object.keys(ADAYLAR).map(ad => ({ ad, r: korel(veri[ad], hedefBasi[ad]), n: veri[ad].length }))
    .sort((a, b) => Math.abs(b.r || 0) - Math.abs(a.r || 0));
for (const s of sat) {
    const g = Math.abs(s.r) >= 0.5 ? 'GUCLU' : (Math.abs(s.r) >= 0.3 ? 'orta' : (Math.abs(s.r) >= 0.15 ? 'zayif' : '-'));
    console.log('  ' + s.ad.padEnd(30) + (Number.isFinite(s.r) ? s.r.toFixed(3) : 'NaN').padStart(12) + String(s.n).padStart(7) + '   ' + g);
}
console.log('');
console.log('  KIYAS: ordu duzeyinde en iyi 0.246, forceRatio 0.160 idi.');
console.log('  Yerel olcut kureseli belirgin geciyorsa -> angajman karari YEREL olcute baglanmali.');
