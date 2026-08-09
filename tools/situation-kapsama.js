// SITUATION KAPSAMA TARAMASI — durum degerlendirmesinin hangi alani KARARLARA giriyor?
//
// KATMAN ATFI (tools/katman-atfi.js): AI olumlerinin %47'si "gordu ama ETIKETLEMEDI" —
// yani Situation katmani tehdidi TEMSIL EDEMIYOR. Bir ornegi bulundu ve duzeltildi
// (hava kategorisi hic yoktu: 467 kararin 467'sinde enemy.air = 0).
// Bu arac ayni taramayi TUM situation alanlarina uygular: uretilen ama HIC OKUNMAYAN alan = olu.
//
// TUKETICI TANIMI: karar veren HER katman. DIKKAT: plan puanlamasi BattleSituation.js ICINDE
// (courseOfActionEvaluator) — ilk surumde onu tuketici saymamistim, yanlis "okunmuyor" cikti.
const fs = require('fs');
const path = require('path');
function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const DIZIN = arg('--dizin', 'C:/Users/osman/Downloads');
const ONEK = arg('--onek', 'pixel-rts-ham-savas-kaydi-');

const DOSYALAR = ['BattleSituation.js', 'BattlePlanning.js', 'BattleExecution.js', 'BattleController.js',
    'BattleCommander.js', 'BattleOracle.js', 'BattleFeatures.js', 'BattleStateFeatures.js', 'Unit.js'];
const KAYNAK = {};
for (const f of DOSYALAR) { try { KAYNAK[f] = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'); } catch (e) { KAYNAK[f] = ''; } }

// en yeni kayittan ornek situation
let dosyalar = fs.readdirSync(DIZIN).filter(f => f.startsWith(ONEK) && f.endsWith('.json'))
    .map(f => ({ f, t: fs.statSync(path.join(DIZIN, f)).mtimeMs })).sort((a, b) => b.t - a.t);
if (!dosyalar.length) { console.error('kayit bulunamadi'); process.exit(1); }
const t = JSON.parse(fs.readFileSync(path.join(DIZIN, dosyalar[0].f), 'utf8')).replay.telemetry;
const kararlar = (t.controllerDecisions || []).filter(c => c.situation);
if (!kararlar.length) { console.error('situation yok'); process.exit(1); }
const s = kararlar[0].situation;

console.log('SITUATION KAPSAMA — ' + dosyalar[0].f.slice(0, 44));
console.log('  ' + Object.keys(s).length + ' alan, ' + kararlar.length + ' karar');
console.log('');
console.log('  ' + 'alan'.padEnd(24) + 'okuyan katmanlar'.padEnd(46) + 'hep-ayni?');
const olu = [], sabit = [];
for (const k of Object.keys(s)) {
    const yer = [];
    for (const [f, src] of Object.entries(KAYNAK)) {
        const n = (src.match(new RegExp('\\.' + k + '\\b', 'g')) || []).length;
        if (n > 0) yer.push(f.replace('.js', '').replace('Battle', '') + '(' + n + ')');
    }
    if (!yer.length) olu.push(k);
    // alanin macta HIC DEGISIP degismedigi (sabitse karar icin bilgisiz)
    const degerler = new Set(kararlar.map(c => {
        const v = c.situation[k];
        return (v && typeof v === 'object') ? JSON.stringify(v).slice(0, 60) : String(v);
    }));
    if (degerler.size === 1) sabit.push(k + '=' + [...degerler][0].slice(0, 24));
    console.log('  ' + k.padEnd(24) + (yer.length ? yer.join(' ') : '*** HIC OKUNMUYOR ***').padEnd(46) +
        (degerler.size === 1 ? 'SABIT' : degerler.size + ' deger'));
}
console.log('');
console.log('  ══ OLU ALANLAR (uretiliyor, hicbir karar okumuyor) ══');
console.log('  ' + (olu.length ? olu.join(', ') : 'yok'));
console.log('');
console.log('  ══ SABIT ALANLAR (mac boyunca hic degismiyor -> karar icin BILGISIZ) ══');
console.log('  ' + (sabit.length ? sabit.join('   ') : 'yok'));
console.log('');
console.log('  NOT: tarama ISIM eslesmesine dayanir. "HIC OKUNMUYOR" kesindir (hicbir dosyada .alan gecmiyor);');
console.log('       okunuyor gorunenler ayni adli baska alanlardan yanlis eslesmis OLABILIR.');
