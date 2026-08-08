// KAPSAMA MATRISI — "veride tanimli ama kodda karsiligi yok" taramasi
//
// KULLANICI (2026-08-08): "'semsiye diye bir mekanizma yok' nasil boyle bir sey gozden kacabilir?
// bir suru beceri testi yaptik. butun gruplar icin bu sekilde bak, hicbir seyi atlama."
// HAKLI: testler VAR OLAN seyleri olcuyordu; OLMAYAN bir seyi hicbir test gosteremez.
// Emsali de var — globals.js: "P21 KOMUTA MENZILI: veride range:0.08 tanimliydi ama kodda karsiligi YOKTU".
//
// YONTEM: UnitData'daki HER birim, HER yetenek, HER ozel alan icin js/ altinda kod referansi aranir.
// Referans yoksa -> OLU VERI (veri var, davranis yok).
const fs = require('fs'); const path = require('path');
const KOK = path.join(__dirname, '..');
const _db = require(path.join(KOK, 'js', 'UnitData.js'));
const _U = (_db && (_db.UNITS_MODERN_DB || _db.UNITS_MODERN || _db)) || {};
const UNITS = (Array.isArray(_U.units) ? _U.units : Object.values(_U)).filter(x => x && x.id);

// savas ile ilgili tum js dosyalari
const DOSYALAR = fs.readdirSync(path.join(KOK, 'js')).filter(f => f.endsWith('.js'));
const KAYNAK = {};
for (const f of DOSYALAR) KAYNAK[f] = fs.readFileSync(path.join(KOK, 'js', f), 'utf8');
const HEPSI = Object.values(KAYNAK).join('\n');

// id -> T.SABIT eslemesi (globals/main icinde T tablosu)
const T_MAP = {};
{
    const m = HEPSI.match(/const\s+T\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/);
    if (m) for (const mm of m[1].matchAll(/([A-Z_0-9]+)\s*:\s*(\d+)/g)) T_MAP[Number(mm[2])] = mm[1];
}
const idToT = {};
UNITS.forEach((u, i) => { if (T_MAP[i]) idToT[u.id] = T_MAP[i]; });

// KOD dosyasi = davranisi UYGULAYAN dosya. UnitData.js SAF VERI; UnitFeatures.js veriden vektor uretir
// (davranis degil). UnitLoader.js veriyi motora BAGLAR -> KODDUR (ilk surumde disarida biraktim; o yuzden
// airToAir gibi CALISAN seyler "olu" gorunmustu — arac hatasiydi, duzeltildi).
const KOD_DOSYASI = (f) => f !== 'UnitData.js' && f !== 'UnitFeatures.js' &&
    (f.indexOf('Battle') === 0 || f === 'Unit.js' || f === 'UnitLoader.js' ||
     f.indexOf('Support') === 0 || f.indexOf('Production') === 0 || f.indexOf('main') === 0 || f === 'VFX.js');

function gecerMi(desen) {
    const nerede = [];
    for (const [f, s] of Object.entries(KAYNAK)) if (s.includes(desen)) nerede.push(f);
    return nerede;
}
function birimGecer(u) {
    const t = idToT[u.id];
    const yer = new Set();
    if (t) for (const f of gecerMi('T.' + t)) yer.add(f);
    for (const f of gecerMi("'" + u.id + "'")) yer.add(f);
    for (const f of gecerMi('"' + u.id + '"')) yer.add(f);
    return [...yer];
}

console.log('KAPSAMA MATRISI — ' + UNITS.length + ' birim, ' + DOSYALAR.length + ' js dosyasi');
console.log('');

// ── 1) BIRIM BASINA KOD REFERANSI ──
console.log('══ 1) BIRIM -> KOD REFERANSI ══');
console.log('  ' + 'birim'.padEnd(22) + 'T sabiti'.padEnd(18) + 'gectigi dosyalar');
const olusuz = [];
for (const u of UNITS) {
    const yer = birimGecer(u);
    const savasYer = yer.filter(f => KOD_DOSYASI(f));
    if (!savasYer.length) olusuz.push(u.id);
    console.log('  ' + u.id.padEnd(22) + (idToT[u.id] || '—').padEnd(18) +
        (savasYer.length ? savasYer.join(' ') : '*** SAVAS KODUNDA HIC GECMIYOR ***'));
}

// ── 2) YETENEKLER: veride tanimli, kodda var mi? ──
console.log('');
console.log('══ 2) YETENEK -> KOD REFERANSI ══');
const yetenekler = {};
for (const u of UNITS) for (const a of (u.abilities || [])) {
    const ad = (typeof a === 'string') ? a : (a && (a.id || a.name));
    if (!ad) continue;
    (yetenekler[ad] = yetenekler[ad] || []).push(u.id);
}
console.log('  ' + 'yetenek'.padEnd(24) + 'birimler'.padEnd(34) + 'kod');
for (const [ad, birimler] of Object.entries(yetenekler).sort()) {
    const yer = gecerMi("'" + ad + "'").concat(gecerMi('"' + ad + '"'))
        .filter(f => KOD_DOSYASI(f));
    console.log('  ' + ad.padEnd(24) + birimler.join(',').slice(0, 32).padEnd(34) +
        (yer.length ? [...new Set(yer)].join(' ') : '*** OLU VERI: kodda yok ***'));
}

// ── 3) BIRIM ALANLARI: veride var, kodda okunuyor mu? ──
console.log('');
console.log('══ 3) BIRIM ALANI -> KOD REFERANSI ══');
const alanlar = new Set();
for (const u of UNITS) for (const k of Object.keys(u)) alanlar.add(k);
for (const u of UNITS) for (const w of (u.weapons || [])) for (const k of Object.keys(w)) alanlar.add('weapons[].' + k);
console.log('  ' + 'alan'.padEnd(24) + 'kod');
for (const a of [...alanlar].sort()) {
    const kisa = a.replace('weapons[].', '');
    const yer = gecerMi('.' + kisa).filter(f => KOD_DOSYASI(f));
    console.log('  ' + a.padEnd(24) + (yer.length ? [...new Set(yer)].slice(0, 5).join(' ') : '*** kodda okunmuyor gibi ***'));
}

// ── 4) GOREV GRUBU ROLLERI: her rolun yurutmede ozel dali var mi? ──
console.log('');
console.log('══ 4) GOREV GRUBU ROLU -> OZEL YURUTME DALI ══');
const roller = ['MAIN','FIXING','FLANK','FIRE_SUPPORT','RECON','SUPPORT','RESERVE'];
const exec = KAYNAK['BattleExecution.js'] || '';
const plan = KAYNAK['BattlePlanning.js'] || '';
console.log('  ' + 'rol'.padEnd(16) + 'yurutmede'.padStart(11) + 'planlamada'.padStart(12) + '   not');
for (const r of roller) {
    const eSay = (exec.split('TASK_GROUP_ROLE.' + r).length - 1);
    const pSay = (plan.split('TASK_GROUP_ROLE.' + r).length - 1);
    console.log('  ' + r.padEnd(16) + String(eSay).padStart(11) + String(pSay).padStart(12) +
        (eSay === 0 ? '   *** YURUTMEDE OZEL DAL YOK ***' : ''));
}

// ── 5) KATEGORI BASINA OZEL DAVRANIS ──
console.log('');
console.log('══ 5) KATEGORI -> OZEL DAVRANIS ARAMASI ══');
const kat = {};
for (const u of UNITS) (kat[u.category || '?'] = kat[u.category || '?'] || []).push(u.id);
const IPUCU = {
    air_defense: ['semsiye', 'umbrella', 'airCover', 'havaSav', 'coverAir'],
    logistics: ['resupply', 'ikmal', 'supplyAura'],
    support: ['heal', 'medic', 'trench', 'siper'],
    indirect: ['counterBattery', 'indirectMassing', 'karsiBatarya'],
    recon: ['OBSERVATION_POSITION', 'RECONNOITER', 'screen'],
    air: ['helo', 'RTB', 'sead'],
    uav: ['drone', 'loiter'],
    command: ['commandRange', 'komuta']
};
console.log('  ' + 'kategori'.padEnd(14) + 'birimler'.padEnd(46) + 'ozel davranis izi');
for (const [k, birimler] of Object.entries(kat).sort()) {
    const izler = (IPUCU[k] || []).filter(x => HEPSI.includes(x));
    console.log('  ' + k.padEnd(14) + birimler.join(',').slice(0, 44).padEnd(46) +
        (izler.length ? izler.join(', ') : '*** IZ YOK ***'));
}
