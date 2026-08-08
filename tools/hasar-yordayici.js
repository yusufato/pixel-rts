// HASARI NE YORDAR? — mac oynamadan, ham kayitlardan yordayici aramasi
//
// BULGU (tools/tahmin-dogrulama.js): kutle/deger temelli HICBIR olcut bu motorda kimin hasar
// verecegini yordamiyor — Lanchester DPS orani 0.08, temastaki 0.12, AI'in kendi forceRatio'su 0.16.
// AI'in TUM degerlendirme yigini (forceRatio, effectiveValue, oracle odulu) bu tur metriklere dayali.
//
// O ZAMAN DOGRU SORU: bu motorda hasar ciktisini ne belirliyor?
// Etiket KESIN: combatEvents gercek hasari tutuyor. Aday yordayicilar 20sn'lik pencerelerde
// olculur, hepsi log-oran (A/B) olarak hasar log-oranina karsi korele edilir.
//
// Kazanan yordayici(lar) angajman kararinin DOGRU aleti olur — elle esik degil, OLCULMUS sinyal.
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const DIZIN = arg('--dizin', 'C:/Users/osman/Downloads');
const ONEK = arg('--onek', 'pixel-rts-ham-savas-kaydi-');
const PENCERE = Number(arg('--pencere', 20)) || 20;

const _db = require(path.join(__dirname, '..', 'js', 'UnitData.js'));
const _U = (_db && (_db.UNITS_MODERN_DB || _db.UNITS_MODERN || _db)) || {};
global.UNITS_MODERN_DB = _U;
const _L = (Array.isArray(_U.units) ? _U.units : Object.values(_U)).filter(x => x && x.id);
const ST = {};
_L.forEach((u, i) => {
    let mx = 0; for (const w of (u.weapons || [])) if ((w.range || 0) > mx) mx = w.range;
    ST[i] = { id: u.id, armorType: u.armorType, weapons: u.weapons || [], cost: (u.cost && u.cost.resource) || 0, menzil: mx };
});
const F = require(path.join(__dirname, '..', 'js', 'BattleForecast.js'));

// ── ADAY YORDAYICILAR ──
// tip 'oran' : log(A/B) — yalniz ikisi de POZITIF ise gecerli
// tip 'fark' : A − B     — isaretli/sifir olabilen buyuklukler icin (log-oran carpitir)
// yeni: TELEMETRI alani gerektirenler (etkiliMenzil vb.) yalniz o alani TASIYAN kayitlarda sayilir.
const ADAYLAR = {
    'deger (maliyet x can)':      { tip: 'oran', f: (us) => us.reduce((a, u) => a + (ST[u.type].cost || 0) * (u.hp / Math.max(1, u.maxHp)), 0) },
    'toplam can':                 { tip: 'oran', f: (us) => us.reduce((a, u) => a + u.hp, 0) },
    'birim sayisi':               { tip: 'oran', f: (us) => us.length },
    'Lanchester D (dps)':         { tip: 'oran', ozel: 'lanchester' },
    'menzil-agirlikli deger':     { tip: 'oran', f: (us) => us.reduce((a, u) => a + (ST[u.type].cost || 0) * (u.hp / Math.max(1, u.maxHp)) * (ST[u.type].menzil || 0), 0) },
    'ates edebilen birim':        { tip: 'fark', f: (us) => us.filter(u => u.attackTargetId != null).length },
    'temastaki birim (<1200px)':  { tip: 'fark', ozel: 'temas' },
    'dolayli-ates birimi sayisi': { tip: 'fark', f: (us) => us.filter(u => (ST[u.type].weapons || []).some(w => w.indirect)).length },
    'siperde/ormanda birim':      { tip: 'fark', f: (us) => us.filter(u => u.inTrench || u.inForest).length },
    'baski (ort, ters)':          { tip: 'fark', f: (us) => us.length ? -us.reduce((a, u) => a + (u.suppression || 0), 0) / us.length : 0 },
    'menzilimde dusman (toplam)': { tip: 'fark', alan: 'menzilimdeDusman', f: (us) => us.reduce((a, u) => a + (u.menzilimdeDusman || 0), 0) },
    'dusman menzilinde (toplam)': { tip: 'fark', alan: 'dusmanMenzilinde', f: (us) => us.reduce((a, u) => a + (u.dusmanMenzilinde || 0), 0) },
    'NET MARUZIYET (toplam)':     { tip: 'fark', alan: 'netMaruziyet', f: (us) => us.reduce((a, u) => a + (u.netMaruziyet || 0), 0) },
    'etkili menzil (ort)':        { tip: 'fark', alan: 'etkiliMenzil', f: (us) => us.length ? us.reduce((a, u) => a + (u.etkiliMenzil || 0), 0) / us.length : 0 }
};

let dosyalar = fs.readdirSync(DIZIN).filter(f => f.startsWith(ONEK) && f.endsWith('.json')).sort();
if (!dosyalar.length) { console.error('kayit bulunamadi'); process.exit(1); }

const veri = {}, hedefBasi = {};   // her yordayici KENDI gecerli satirlarini tutar
const hedef = [];
for (const ad of Object.keys(ADAYLAR)) { veri[ad] = []; hedefBasi[ad] = []; }

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
        let gA = 0, gB = 0;
        for (const e of ce) {
            if (e.seconds < t0 || e.seconds >= t1) continue;
            if (e.attackerSide === A_SIDE) gA += (e.damage || 0); else gB += (e.damage || 0);
        }
        if (gA + gB < 50 || gA <= 0 || gB <= 0) continue;
        const canli = (s.units || []).filter(u => u.hp > 0);
        const uA = canli.filter(u => u.side === A_SIDE), uB = canli.filter(u => u.side === B_SIDE);
        if (!uA.length || !uB.length) continue;

        const y = Math.log(gA / gB);
        const mp = (us) => us.map(u => ({ stats: ST[u.type], hp: u.hp, maxHp: u.maxHp }));
        for (const [ad, spec] of Object.entries(ADAYLAR)) {
            // telemetri alani gerekiyorsa ve kayitta YOKSA bu satiri atla (eski kayitlarda alan yok -> 0 ile doldurmak
            // sahte "fark yok" uretirdi; sessiz carpitma yerine satiri dusuruyoruz)
            if (spec.alan && !canli.some(u => u[spec.alan] !== undefined)) continue;
            let a, b;
            if (spec.ozel === 'lanchester') {
                a = F.forecastArmyAggregate(mp(uA), mp(uB)).D;
                b = F.forecastArmyAggregate(mp(uB), mp(uA)).D;
            } else if (spec.ozel === 'temas') {
                a = uA.filter(u => uB.some(v => Math.hypot(v.x - u.x, v.y - u.y) <= 1200)).length;
                b = uB.filter(u => uA.some(v => Math.hypot(v.x - u.x, v.y - u.y) <= 1200)).length;
            } else { a = spec.f(uA); b = spec.f(uB); }
            let x;
            if (spec.tip === 'oran') { if (!(a > 0) || !(b > 0)) continue; x = Math.log(a / b); }
            else { x = a - b; }
            if (!Number.isFinite(x)) continue;
            veri[ad].push(x); hedefBasi[ad].push(y);
        }
        hedef.push(y);
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

console.log('HASARI NE YORDAR — ' + dosyalar.length + ' ham kayit, ' + hedef.length + ' pencere (' + PENCERE + 'sn)');
console.log('  hedef: log(A hasari / B hasari).  A = INSAN, B = AI.  Tum yordayicilar log-oran.');
console.log('');
console.log('  ' + 'yordayici'.padEnd(30) + 'korelasyon'.padStart(12) + 'ornek'.padStart(7) + '   yorum');
const sat = Object.keys(ADAYLAR).map(ad => ({ ad, r: korel(veri[ad], hedefBasi[ad]), n: veri[ad].length }))
    .sort((a, b) => Math.abs(b.r || 0) - Math.abs(a.r || 0));
for (const s of sat) {
    const g = Math.abs(s.r) >= 0.5 ? 'GUCLU' : (Math.abs(s.r) >= 0.3 ? 'orta' : (Math.abs(s.r) >= 0.15 ? 'zayif' : '-'));
    console.log('  ' + s.ad.padEnd(30) + (Number.isFinite(s.r) ? s.r.toFixed(3) : 'NaN').padStart(12) + String(s.n).padStart(7) + '   ' + g);
}
console.log('');
console.log('  NOT: |r| 0.16 = AI\'in bugun kullandigi forceRatio\'nun seviyesi. Onu belirgin gecen');
console.log('       yordayici, angajman kararinin DOGRU aleti demektir.');
