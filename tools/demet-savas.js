// DEMET SAVASI — beceri agacindan cikan 6 guclendirmenin ACIK hali vs KAPALI hali.
// Kullanici: "simdiye kadar 6 seyi guclendirdik, bu 6 seyin guclenmis hali ile guclenmemis hali
// olan deterministik bir savas ortami hazirla."
//
// TASARIM KARARLARI (hepsi docs/OLCUM-TUZAKLARI.md'den):
//   * ESLESTIRILMIS FARK (E3): ayni tohumda iki kol da kosulur, fark tohum-ici alinir. Marj std'si
//     ~3114; eslestirilmemis karsilastirmada 12 tohum hicbir sey gostermez, eslestirilmisde gosterir.
//   * TARAF-BASI (B3): demet YALNIZ KIRMIZI'ya verilir; mavi iki kolda da AYNI (demetsiz). Boylece
//     fark demete atfedilebilir. Bu yuzden ferry bayraklari da taraf-basi yapildi.
//   * DURUM SIZINTISI (B5): her kolun basinda TUM demet bayraklari iki taraf icin de ACIKCA kurulur;
//     onceki kolun degeri sizmaz.
//   * DETERMINIZM: --determinizm ile ayni kol iki kez kosulur ve sonuclarin BIREBIR ayni oldugu
//     dogrulanir. Kanit olmadan "deterministik ortam" denmez.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 12)) || 12);
const ROL = arg('--rol', 'saldiran');            // saldiran | savunan | her
const DET = process.argv.includes('--determinizm');
const TARIF = process.argv.includes('--tarif');   // kirmizi SABIT gercekci tarifle kurulsun
// BIRIMLI SENARYO: AI'nin DOGAL ordusunda ne nakliye helosu ne komuta araci var (olculdu) ve
// gozcu/ikmal/istihkam zaten mevcut -> demetin 6 uyesinin 5'i BAGLAYACAK BIR SEY BULAMIYOR.
// Bu kip, demetin uyelerinin gercekten is gordugu bir orduyu kurar: helo + komuta + uzun menzil.
const BIRIMLI = process.argv.includes('--birimli');
const CIKTI = arg('--out', 'qa-runtime/demet-savas.json');

// TOHUM HAVUZU: tarama havuzu (24) — karar icin FINAL havuzu ayri tutulur.
const HAVUZ = [2024, 3141, 777, 11, 202, 333, 4001, 4003, 4007, 4013, 4019, 4021,
               4027, 4049, 4051, 4057, 4073, 4079, 4091, 4093, 4099, 4111, 4127, 4129];
// AYRILMIS HAVUZ (tuzak E1): --atla ile ilk N tohum atlanir -> karar TARAMA havuzunda degil
// dokunulmamis FINAL havuzunda dogrulanir.
const ATLA = Math.max(0, Number(arg('--atla', 0)) || 0);
const TOHUMLAR = HAVUZ.slice(ATLA, ATLA + N);
const GERCEKCI_TABAN = JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));

// ── DEMET UYELERI: beceri agacindan cikan 6 guclendirme ──
const DEMET = [
    { ad: 'gozcu-kurali',    tip: 'delta',  anahtar: 'spotterRequirement',   birim: 'balistik/MLRS' },
    { ad: 'ikmal-kurali',    tip: 'delta',  anahtar: 'logisticsRequirement', birim: 'CNRA/topcu' },
    { ad: 'us-kurali',       tip: 'delta',  anahtar: 'airBaseRequirement',   birim: 'nakliye helo' },
    { ad: 'ferry-duzeltme',  tip: 'global', anahtar: 'BATTLE_FERRY_FIX',     birim: 'nakliye helo' },
    { ad: 'istihkam-ileri',  tip: 'delta',  anahtar: 'engineerForward',      birim: 'istihkam' },
    { ad: 'komuta-menzili',  tip: 'delta',  anahtar: 'commandRange',         birim: 'komuta araci' },
];

// Her kolun basinda TUM demet bayraklari ACIKCA kurulur (sizinti yok).
function bayraklar(acikKirmizi) {
    const L = [];
    for (const d of DEMET) {
        if (d.tip === 'delta') {
            // pro-deltalar taraf-basi degil (tek nesne) -> kirmizi/mavi ayrimi icin
            // demet YALNIZ kirmiziya verilecekse delta nesnesi mac basina kurulur.
            L.push('BATTLE_INTEL4PRO_DELTAS.' + d.anahtar + ' = ' + acikKirmizi + ';');
        }
    }
    // MAVI: demetin DAVRANIS uyeleri her iki kolda da KAPALI (tuzak B3). Kompozisyon kurallari
    // zaten yalniz `pro:true` ile kurulan orduya (kirmizi) uygulaniyor.
    L.push('BATTLE_INTEL4PRO_DELTAS_BLUE = { engineerForward: false, commandRange: false };');
    L.push('BATTLE_INTEL4PRO_DELTAS_RED = null;');
    L.push('BATTLE_FERRY_FIX_RED = ' + acikKirmizi + ';');
    L.push('BATTLE_FERRY_FIX_BLUE = false;');
    L.push('BATTLE_HELO_KRITIK_RED = ' + (acikKirmizi ? 0.12 : 0) + ';');
    L.push('BATTLE_HELO_KRITIK_BLUE = 0;');
    return L.join(' ');
}

function kos(acik, seed, kirmiziSaldiran) {
    const kod = [
        '(() => {',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        bayraklar(acik),
        // VARSAYILAN: tarif YOK -> kirmizi orduyu AI kendi kurar ve kompozisyon kurallari
        // (gozcu/ikmal/us) gercekten devreye girebilir. Sabit gercekci tarif zaten kesif+ikmal+
        // istihkam icerdigi icin kurallara is birakmiyordu (bind kaniti bunu gosterdi).
        (TARIF || BIRIMLI)
            ? 'BATTLE_RECIPE_RED = Object.assign({ ad:"DEMET", rol:"' + (kirmiziSaldiran ? 'attacker' : 'defender') + '", zorunlu:' + (BIRIMLI ? '{ transport_helo:2, command_vehicle:1, mlrs:1 }' : '{}') + ', tavan:{}, artik:[] }, ' + JSON.stringify(GERCEKCI_TABAN) + ');'
            : 'BATTLE_RECIPE_RED = null;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ' }), false, { source:"ds", ally:true });',
        'startBattle();',
        'const kadroBas = {};',
        'for (const u of SIM.units) { if (!u.isRed) continue; const id = (STATS[u.type]||{}).id || u.type; kadroBas[id] = (kadroBas[id]||0) + 1; }',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '} } finally { SIM.headless = ph; }',
        'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);',
        'const b = SIM.battle || {};',
        'const kadro = {};',
        'for (const u of SIM.units) { if (!u.isRed) continue; const id = (STATS[u.type]||{}).id || u.type; kadro[id] = (kadro[id]||0) + 1; }',
        'let kirmiziKalan = 0, maviKalan = 0, kirmiziSay = 0, maviSay = 0;',
        'for (const u of SIM.units) { if (u.dead) continue; const v = (STATS[u.type] && STATS[u.type].cost) || 0;',
        '  if (u.isRed) { kirmiziKalan += v; kirmiziSay++; } else { maviKalan += v; maviSay++; } }',
        'BATTLE_RECIPE_RED = null;',
        'return JSON.stringify({ marj: Math.round(oS.effectiveValue - oD.effectiveValue),',
        '  bitisTik: SIM.tick, kirmiziKalan, maviKalan, kirmiziSay, maviSay, kadro: kadroBas,',
        '  kazanan: b.winnerSide === true ? 1 : (b.winnerSide === false ? 0 : -1) });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'ds.js' }));
}

const { ctx } = tezgahKur();

const roller = ROL === 'her' ? [true, false] : [ROL === 'saldiran'];
console.log('DEMET SAVASI — ' + (BIRIMLI ? '[BIRIMLI ordu: helo+komuta+MLRS zorunlu] ' : (TARIF ? '[sabit gercekci tarif] ' : '[AI dogal ordusu] ')) +  + TOHUMLAR.length + ' tohum x ' + roller.length + ' rol x 2 kol = ' +
    (TOHUMLAR.length * roller.length * 2) + ' mac');
console.log('');
console.log('  DEMET UYELERI (yalniz KIRMIZI alir; mavi iki kolda da demetsiz):');
for (const d of DEMET) console.log('    - ' + d.ad.padEnd(18) + d.birim.padEnd(16) + '(' + d.anahtar + ')');
console.log('');

if (DET) {
    console.log('  DETERMINIZM KONTROLU: ayni kol iki kez kosuluyor...');
    const a1 = kos(true, TOHUMLAR[0], true);
    const a2 = kos(true, TOHUMLAR[0], true);
    const ayni = JSON.stringify(a1) === JSON.stringify(a2);
    console.log('    kosu1: ' + JSON.stringify(a1));
    console.log('    kosu2: ' + JSON.stringify(a2));
    console.log('    -> ' + (ayni ? 'BIREBIR AYNI (deterministik)' : '*** SAPMA VAR ***'));
    console.log('');
    if (!ayni) process.exit(1);
}

const satirlar = [];
const t0 = Date.now();
for (const kirmiziSaldiran of roller) {
    for (const seed of TOHUMLAR) {
        const kapali = kos(false, seed, kirmiziSaldiran);
        const acik = kos(true, seed, kirmiziSaldiran);
        satirlar.push({ seed, rol: kirmiziSaldiran ? 'saldiran' : 'savunan',
            marjKapali: kapali.marj, marjAcik: acik.marj, fark: acik.marj - kapali.marj,
            kazananKapali: kapali.kazanan, kazananAcik: acik.kazanan,
            kalanKapali: kapali.kirmiziKalan, kalanAcik: acik.kirmiziKalan,
            tikKapali: kapali.bitisTik, tikAcik: acik.bitisTik });
    }
}
const gecen = ((Date.now() - t0) / 1000).toFixed(0);

// BIND KANITI (tuzak B2): demet KIRMIZI ORDUSUNU gercekten degistiriyor mu?
{
    const a = kos(false, TOHUMLAR[0], roller[0]), b = kos(true, TOHUMLAR[0], roller[0]);
    const tipler = new Set([...Object.keys(a.kadro), ...Object.keys(b.kadro)]);
    const fark = [];
    for (const t of [...tipler].sort()) {
        const x = a.kadro[t] || 0, y = b.kadro[t] || 0;
        if (x !== y) fark.push(t + ' ' + x + '->' + y);
    }
    console.log('  BIND KANITI (tohum ' + TOHUMLAR[0] + ', kirmizi kadro KAPALI->ACIK):');
    console.log('    ' + (fark.length ? fark.join(', ') : 'KADRO AYNI'));
    console.log('    kirmizi kadro: ' + Object.entries(b.kadro).sort((x,y)=>y[1]-x[1]).map(([t,n])=>t+' '+n).join(', '));
    console.log('');
}
console.log('  tohum'.padEnd(9) + 'rol'.padEnd(10) + 'marjKAPALI'.padStart(12) + 'marjACIK'.padStart(11) + '   FARK'.padStart(10) + '  kirmiziKalan(K->A)'.padStart(22));
for (const s of satirlar) {
    console.log('  ' + String(s.seed).padEnd(9) + s.rol.padEnd(10) +
        String(s.marjKapali).padStart(12) + String(s.marjAcik).padStart(11) +
        ((s.fark > 0 ? '+' : '') + s.fark).padStart(10) +
        (s.kalanKapali + ' -> ' + s.kalanAcik).padStart(22));
}

function ist(xs) {
    const n = xs.length, m = xs.reduce((a, b) => a + b, 0) / n;
    const v = n > 1 ? xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (n - 1) : 0;
    return { n, ort: m, std: Math.sqrt(v), sh: Math.sqrt(v / n) };
}
const farklar = satirlar.map(s => s.fark);
const f = ist(farklar);
const kazKapali = satirlar.filter(s => s.kazananKapali === 1).length;
const kazAcik = satirlar.filter(s => s.kazananAcik === 1).length;

console.log('');
console.log('  ESLESTIRILMIS FARK (ACIK - KAPALI, ayni tohum):');
console.log('    ortalama : ' + (f.ort > 0 ? '+' : '') + f.ort.toFixed(0) + '   std ' + f.std.toFixed(0) +
    '   std.hata ' + f.sh.toFixed(0));
console.log('    t degeri : ' + (f.sh ? (f.ort / f.sh).toFixed(2) : '-') + '   (|t| >= 2 ~ %95 anlamli)');
console.log('    demet lehine ' + farklar.filter(x => x > 0).length + '/' + farklar.length + ' mac');
console.log('    KIRMIZI GALIBIYET: kapali ' + kazKapali + '/' + satirlar.length + '  ->  acik ' + kazAcik + '/' + satirlar.length);
console.log('');
console.log('  OKUMA: |t| < 2 ise "fark GOSTERILEMEDI" denir; "fark yok" DENMEZ. Karar icin');
console.log('         ayrilmis FINAL havuzunda dogrulama sarttir (tuzak E1).');
console.log('  sure: ' + gecen + 'sn');

fs.writeFileSync(CIKTI, JSON.stringify({ demet: DEMET, tohumlar: TOHUMLAR, roller, satirlar, ozet: f }, null, 1));
console.log('  -> ' + CIKTI);
