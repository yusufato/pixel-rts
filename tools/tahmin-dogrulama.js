// MUHAREBE TAHMINI — DOGRULAMA (mac oynamadan, kullanicinin 6 ham kaydindan)
//
// js/BattleForecast.js analitik bir Lanchester tahmincisi kuruyor (egitim YOK, katsayilar oyunun
// kendi damageMatrix'inden). Once DOGRULUGU olculur, ancak gecerse karara baglanir.
//
// AI'IN BUGUNKU ALETI: forceRatio = deger orani (maliyet x can). Tahminci ONU YENMELI, yoksa
// yeni bir sey eklemenin anlami yok.
//
// UC SINAV:
//  S1 DPS ORANI  : tahminin D_A/D_B'si, GERCEK hasar orani ile ne kadar ortusuyor?
//                  (combatEvents tam hasar tutuyor -> etiket kesin. Mutlak hiz degil ORAN sinaniyor,
//                   cunku modelde herkes herkese atiyor varsayimi var, sahada degil.)
//  S2 TEMASTAKI  : ayni sinav ama YALNIZ temastaki birimlerle (modelin varsayimina daha yakin)
//  S3 MAC SONUCU : t=0'daki kadro ile kazanan + kazananin kalan orani dogru mu?
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const DIZIN = arg('--dizin', 'C:/Users/osman/Downloads');
const ONEK = arg('--onek', 'pixel-rts-ham-savas-kaydi-');
const PENCERE = Number(arg('--pencere', 20)) || 20;      // saniye
const TEMAS_R = Number(arg('--temas', 1200)) || 1200;    // px

// UnitData -> STATS benzeri (cost SAYI, weapons aynen)
const _db = require(path.join(__dirname, '..', 'js', 'UnitData.js'));
const _U = (_db && (_db.UNITS_MODERN_DB || _db.UNITS_MODERN || _db)) || {};
global.UNITS_MODERN_DB = _U;
const _L = (Array.isArray(_U.units) ? _U.units : Object.values(_U)).filter(x => x && x.id);
const STATS_BY_INDEX = {};
_L.forEach((u, i) => {
    STATS_BY_INDEX[i] = {
        id: u.id, armorType: u.armorType, weapons: u.weapons || [],
        cost: (u.cost && u.cost.resource) || 0, hp: u.hp,
        air: (u.category === 'air' || u.category === 'uav'), category: u.category
    };
});
const F = require(path.join(__dirname, '..', 'js', 'BattleForecast.js'));

let dosyalar = fs.readdirSync(DIZIN).filter(f => f.startsWith(ONEK) && f.endsWith('.json')).sort();
if (!dosyalar.length) { console.error('kayit bulunamadi'); process.exit(1); }

const ort = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);
// Pearson korelasyonu
function korel(xs, ys) {
    const n = Math.min(xs.length, ys.length); if (n < 3) return NaN;
    const mx = ort(xs.slice(0, n)), my = ort(ys.slice(0, n));
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
    return (sxx > 0 && syy > 0) ? sxy / Math.sqrt(sxx * syy) : NaN;
}

const S1 = { tahmin: [], gercek: [] }, S2 = { tahmin: [], gercek: [] }, S1b = { tahmin: [] };
const S3 = [];

for (const dos of dosyalar) {
    const d = JSON.parse(fs.readFileSync(path.join(DIZIN, dos), 'utf8'));
    const r = d.replay || {}, t = r.telemetry || {};
    const sm = t.samples || [], ce = t.combatEvents || [];
    if (!sm.length || !ce.length) continue;
    const fin = t.finalSummary || {};
    const aiKirmizi = (t.rakipTaraf || 'kirmizi') !== 'mavi';
    const A_SIDE = aiKirmizi ? 'blue' : 'red';   // A = INSAN
    const B_SIDE = aiKirmizi ? 'red' : 'blue';   // B = AI

    const birimler = (s, side, sadeceTemas) => {
        const hepsi = (s.units || []).filter(u => u.hp > 0);
        const bizim = hepsi.filter(u => u.side === side);
        if (!sadeceTemas) return bizim.map(u => ({ stats: STATS_BY_INDEX[u.type], hp: u.hp, maxHp: u.maxHp }));
        const karsi = hepsi.filter(u => u.side !== side);
        return bizim.filter(u => karsi.some(v => Math.hypot(v.x - u.x, v.y - u.y) <= TEMAS_R))
            .map(u => ({ stats: STATS_BY_INDEX[u.type], hp: u.hp, maxHp: u.maxHp }));
    };

    // ── S1/S2: kayan pencerede tahmin edilen DPS orani vs GERCEK hasar orani ──
    const adim = Math.max(1, Math.round(PENCERE / 0.5));
    for (let i = 0; i + adim < sm.length; i += adim) {
        const s = sm[i], t0 = s.seconds, t1 = sm[i + adim].seconds;
        let gA = 0, gB = 0;
        for (const e of ce) {
            if (e.seconds < t0 || e.seconds >= t1) continue;
            if (e.attackerSide === A_SIDE) gA += (e.damage || 0); else gB += (e.damage || 0);
        }
        // IKI TARAF DA hasar vermis olmali: biri 0 ise log(oran) sonsuz olur ve korelasyon NaN doner (yasandi).
        if (gA + gB < 50 || gA <= 0 || gB <= 0) continue;
        const gercekOran = gA / gB;
        for (const [kutu, temas] of [[S1, false], [S2, true]]) {
            const bA = birimler(s, A_SIDE, temas), bB = birimler(s, B_SIDE, temas);
            if (!bA.length || !bB.length) continue;
            const agg = F.forecastArmyAggregate(bA, bB), aggB = F.forecastArmyAggregate(bB, bA);
            if (!(agg.D > 0) || !(aggB.D > 0)) continue;
            kutu.tahmin.push(Math.log(agg.D / aggB.D));
            kutu.gercek.push(Math.log(gercekOran));
        }
        // TABAN ALET: forceRatio (deger orani) ayni pencerede
        const deger = (side) => (s.units || []).filter(u => u.side === side && u.hp > 0)
            .reduce((v, u) => v + (STATS_BY_INDEX[u.type].cost || 0) * (u.hp / Math.max(1, u.maxHp)), 0);
        const vA = deger(A_SIDE), vB = deger(B_SIDE);
        if (vA > 0 && vB > 0) S1b.tahmin.push(Math.log(vA / vB));
    }

    // ── S3: t=0 kadro ile mac sonucu ──
    const s0 = sm[0];
    const fA = F.battleForecastCombat(birimler(s0, A_SIDE, false), birimler(s0, B_SIDE, false));
    const son = sm[sm.length - 1];
    const canSon = (side) => (son.units || []).filter(u => u.side === side && u.hp > 0).reduce((a, u) => a + u.hp, 0);
    const canBas = (side) => (s0.units || []).filter(u => u.side === side && u.hp > 0).reduce((a, u) => a + u.hp, 0);
    const gercekKazanan = canSon(A_SIDE) > canSon(B_SIDE) ? 'A' : (canSon(B_SIDE) > canSon(A_SIDE) ? 'B' : 'berabere');
    S3.push({
        tohum: fin.seed, tahmin: fA.kazanan, gercek: gercekKazanan,
        tahminKalan: fA.kazanan === 'A' ? fA.kalanOranA : fA.kalanOranB,
        gercekKalan: gercekKazanan === 'A' ? canSon(A_SIDE) / Math.max(1, canBas(A_SIDE)) : canSon(B_SIDE) / Math.max(1, canBas(B_SIDE)),
        oran: fA.oran
    });
}

console.log('MUHAREBE TAHMINI — DOGRULAMA (' + dosyalar.length + ' ham kayit, pencere ' + PENCERE + 'sn)');
console.log('  A = INSAN, B = AI.  Sinav: tahmin edilen hasar orani, GERCEK hasar oranini tutuyor mu?');
console.log('');
console.log('  ' + 'sinav'.padEnd(38) + 'ornek'.padStart(7) + 'korelasyon'.padStart(12));
console.log('  ' + 'S1 tum ordu (Lanchester DPS orani)'.padEnd(38) + String(S1.tahmin.length).padStart(7) + f2(korel(S1.tahmin, S1.gercek)).padStart(12));
console.log('  ' + ('S2 YALNIZ temastaki (' + TEMAS_R + 'px)').padEnd(38) + String(S2.tahmin.length).padStart(7) + f2(korel(S2.tahmin, S2.gercek)).padStart(12));
console.log('  ' + 'TABAN: forceRatio (deger orani)'.padEnd(38) + String(S1b.tahmin.length).padStart(7) + f2(korel(S1b.tahmin, S1.gercek)).padStart(12));
console.log('');
console.log('  ── S3: t=0 kadrosundan mac sonucu ──');
console.log('  ' + 'tohum'.padEnd(12) + 'tahmin'.padStart(8) + 'gercek'.padStart(8) + 'oran'.padStart(9) + 'tah.kalan'.padStart(11) + 'ger.kalan'.padStart(11));
let dogru = 0;
for (const x of S3) {
    if (x.tahmin === x.gercek) dogru++;
    console.log('  ' + String(x.tohum).padEnd(12) + x.tahmin.padStart(8) + x.gercek.padStart(8) +
        (Number.isFinite(x.oran) ? f2(x.oran) : '∞').padStart(9) + f2(x.tahminKalan).padStart(11) + f2(x.gercekKalan).padStart(11));
}
console.log('  kazanan dogrulugu: ' + dogru + '/' + S3.length);
console.log('');
console.log('  KARAR KURALI: S2 korelasyonu TABAN\'i belirgin gecmiyorsa tahminciyi karara BAGLAMA —');
console.log('                yeni alet eskisinden iyi degilse eklemek sadece karmasiklik olur.');
