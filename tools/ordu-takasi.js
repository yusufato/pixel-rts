// ORDU TAKASI — FAZ 0: kompozisyon mu, yurutme mu?
//
// SORU (2026-08-08 derin analizden): AI'in hasar ciktisinin %45'i iki TANKSAVAR sisteminden
// geliyor, oysa insanin ordusunda zirh butcenin %8'i. AI 47506 hasar yiyor, insan 17280.
// Ama bu gozlem ORDU farki ile YURUTME farkini ic ice olcuyor.
//
// DENEY: iki tarafi da AYNI kod-AI surer; TEK degisken bilesim.
//   kontrol : AI-ordusu  vs AI-ordusu   -> marj ~0 olmali (olcek/taraf-yanliligi kaniti)
//   kol A   : AI-ordusu  vs INSAN-ordusu (insan mavide)
//   kol B   : INSAN-ordusu vs AI-ordusu  (insan kirmizida)  <- taraf yanliligini goturur
// A ve B'nin ORTALAMASI = insan KOMPOZISYONUNUN saf avantaji.
//
// KARAR KURALI: avantaj ~0 ise TEDARIK KALDIRAC DEGILDIR, plan burada olur ve yon yurutmeye doner.
//
// TUZAK NOTU (bugun iki kez yasandi): tarif YALNIZ bir tarafa uygulanirsa oteki taraf bos/bozuk
// kadro ile cikar ve tablo anlamsiz olur. Bu yuzden HER kosuda IKI TARAFIN kadrosu basilir (bind kaniti).
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 4)) || 4);
const ATLA = Math.max(0, Number(arg('--atla', 0)) || 0);
const KONTROL = process.argv.includes('--kontrol');
// CYBORG HAVUZU (docs/IKI-MAKINE.md): 100000-199999. Diger makineyle CAKISMAZ.
const HAVUZ = [];
for (let i = 0; i < 64; i++) HAVUZ.push(100000 + i * 137);
const TOHUMLAR = HAVUZ.slice(ATLA, ATLA + N);

let ORDULAR = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'qa-runtime', 'insan-ordulari.json'), 'utf8'));
// AGIRLIK ARAMASI icin: --ordu N ilk N orduyu (arama kumesi), --orduatla N ile ayrik test kumesi
const _ordAtla = Math.max(0, Number(arg('--orduatla', 0)) || 0);
const _ordN = Number(arg('--ordu', 0)) || 0;
if (_ordAtla || _ordN) ORDULAR = ORDULAR.slice(_ordAtla, _ordAtla + (_ordN || ORDULAR.length));

// insan ordusu -> tarif (paylar BOS + zorunlu TAM adet + maxUnits = tam adet => birebir ordu, RNG yok)
function tarifYap(ordu, rol) {
    return { ad: 'INSAN-' + ordu.tohum, rol, paylar: {}, tipPaylari: null,
             zorunlu: ordu.insan, tavan: {}, artik: [] };
}

const { ctx } = tezgahKur();

// kip: 'kontrol' | 'insanMavi' | 'insanKirmizi'
function kos(seed, ordu, kirmiziSaldiran, kip) {
    const tarif = tarifYap(ordu, kirmiziSaldiran ? 'attacker' : 'defender');
    const adet = ordu.insanAdet;
    const maviAI = 'battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ' })';
    const maviInsan = 'battleBuildArmyManifest(6500, { maxUnits:' + adet + ', recipe:' + JSON.stringify(tarif) + ' })';
    const kod = [
        '(() => {',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        // KIRMIZI: tarif verilirse insan ordusu, yoksa AI kendi kurar
        (kip === 'insanKirmizi')
            ? 'BATTLE_RECIPE_RED = ' + JSON.stringify(tarif) + ';'
            : 'BATTLE_RECIPE_RED = null;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        // MAVI: kol A'da insan ordusu, digerlerinde AI ordusu
        'battleDeployManifest(' + (kip === 'insanMavi' ? maviInsan : maviAI) + ', false, { source:"ot", ally:true });',
        'startBattle();',
        // BIND KANITI — iki tarafin baslangic kadrosu
        'const kadroK = {}, kadroM = {}; let degerK = 0, degerM = 0;',
        'for (const u of SIM.units) { if (u.dead) continue; const id = (STATS[u.type]||{}).id || u.type; const c = (STATS[u.type]||{}).cost || 0;',
        '  if (u.isRed) { kadroK[id] = (kadroK[id]||0)+1; degerK += c; } else { kadroM[id] = (kadroM[id]||0)+1; degerM += c; } }',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '} } finally { SIM.headless = ph; }',
        'const oK = battleArmyObservation(true), oM = battleArmyObservation(false);',
        'BATTLE_RECIPE_RED = null;',
        'return JSON.stringify({ marjKirmizi: Math.round(oK.effectiveValue - oM.effectiveValue),',
        '  kadroK, kadroM, degerK, degerM, bitisTik: SIM.tick });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'ot.js' }));
}

console.log('ORDU TAKASI — ayni kod-AI (intel4-pro) iki tarafta; TEK degisken BILESIM');
console.log('  ' + ORDULAR.length + ' insan ordusu x ' + TOHUMLAR.length + ' tohum x 2 rol (saldiran/savunan)');
console.log('  tohum havuzu: CYBORG (' + TOHUMLAR[0] + '..' + TOHUMLAR[TOHUMLAR.length - 1] + ')');
console.log('');

const ort = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);

// ── BIND KANITI: ilk kosuda iki tarafin kadrosu ──
{
    const r = kos(TOHUMLAR[0], ORDULAR[0], false, 'insanMavi');
    const doku = (k) => Object.entries(k).sort((a, b) => b[1] - a[1]).map(([a, b]) => a + '×' + b).join(' ');
    console.log('  BIND KANITI (tohum ' + TOHUMLAR[0] + ', insan ordusu ' + ORDULAR[0].tohum + ' MAVIDE):');
    console.log('    KIRMIZI (AI ordusu)  ' + r.degerK + 'TL : ' + doku(r.kadroK));
    console.log('    MAVI (INSAN ordusu)  ' + r.degerM + 'TL : ' + doku(r.kadroM));
    const beklenen = Object.entries(ORDULAR[0].insan).sort().map(([a, b]) => a + '×' + b).join(' ');
    const gercek = Object.entries(r.kadroM).sort().map(([a, b]) => a + '×' + b).join(' ');
    console.log('    tarif UYDU MU: ' + (beklenen === gercek ? 'EVET' : 'HAYIR *** tarif tutmadi, tablo ANLAMSIZ ***'));
    if (beklenen !== gercek) { console.log('      beklenen: ' + beklenen); console.log('      gercek  : ' + gercek); }
    console.log('');
}

// ── KONTROL: AI vs AI, marj ~0 olmali ──
if (KONTROL) {
    const k = [];
    for (const s of TOHUMLAR) for (const rol of [true, false]) k.push(kos(s, ORDULAR[0], rol, 'kontrol').marjKirmizi);
    const sd = Math.sqrt(k.reduce((a, b) => a + (b - ort(k)) ** 2, 0) / Math.max(1, k.length - 1));
    console.log('  KONTROL (AI ordusu vs AI ordusu): marj ort ' + f1(ort(k)) + '  std ' + f1(sd) +
        '  n=' + k.length + '   -> olcek/taraf-yanliligi');
    console.log('');
}

// ── KOL A ve B ──
const satir = [];
for (const ordu of ORDULAR) {
    const avantaj = [];
    for (const s of TOHUMLAR) {
        for (const rol of [true, false]) {
            const A = kos(s, ordu, rol, 'insanMavi');    // insan MAVIDE -> avantaj = -(kirmizi marji)
            const B = kos(s, ordu, rol, 'insanKirmizi'); // insan KIRMIZIDA -> avantaj = +(kirmizi marji)
            avantaj.push(-A.marjKirmizi);
            avantaj.push(B.marjKirmizi);
        }
    }
    const o = ort(avantaj);
    const sd = Math.sqrt(avantaj.reduce((a, b) => a + (b - o) ** 2, 0) / Math.max(1, avantaj.length - 1));
    const se = sd / Math.sqrt(avantaj.length);
    satir.push({ tohum: ordu.tohum, o, se, n: avantaj.length, lehte: avantaj.filter(x => x > 0).length, hepsi: avantaj });
    console.log('  insan ordusu ' + String(ordu.tohum).padEnd(12) +
        ' avantaj ' + ((o > 0 ? '+' : '') + Math.round(o)).padStart(7) +
        '  std.hata ' + String(Math.round(se)).padStart(5) +
        '  t ' + (se ? (o / se).toFixed(2) : '-').padStart(6) +
        '  lehte ' + satir[satir.length - 1].lehte + '/' + avantaj.length);
}

console.log('');
const hepsi = satir.flatMap(x => x.hepsi);
const O = ort(hepsi);
const SD = Math.sqrt(hepsi.reduce((a, b) => a + (b - O) ** 2, 0) / Math.max(1, hepsi.length - 1));
const SE = SD / Math.sqrt(hepsi.length);
console.log('  ══ INSAN KOMPOZISYONUNUN SAF AVANTAJI ══');
console.log('     ' + (O > 0 ? '+' : '') + Math.round(O) + '   std.hata ' + Math.round(SE) +
    '   t ' + (SE ? (O / SE).toFixed(2) : '-') + '   n=' + hepsi.length +
    '   lehte ' + hepsi.filter(x => x > 0).length + '/' + hepsi.length);
console.log('');
console.log('  YORUM: |t| < 2 ise TEDARIK KALDIRAC DEGIL -> plan burada durur, yon yurutmeye doner.');
