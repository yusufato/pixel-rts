// TITREME TESHISI — kullanici: "oyun ici birlik titremeleri cok sinir bozucu".
// Yontem kullanicinin tarif ettigi gibi: TEK mac, 0.5 saniyelik goruntuler, 100 saniye.
//
// TITREME NEDIR (olculebilir tanim): birim ILERLEMEDEN yer degistiriyor. Iki ayri olcut:
//   1. YON TERSINMESI — ardisik iki 0.5sn araliginda hareket vektorunun acisi >120 derece dondu.
//      Ileri-geri salinim tam budur. (Tuzak C5: tek esikli "hareket var mi" olcutu mikro-sarsintiyi
//      gercek ping-pong'dan AYIRAMIYOR — bu yuzden aci kullaniliyor.)
//   2. YOL/YERDEGISTIRME ORANI — 10sn'lik pencerede katedilen YOL / net YERDEGISTIRME.
//      1.0 = duz gitti. >3 = ayni yerde debeleniyor.
//
// Ayrica titreyen birimlerin TIPI ve o andaki durumu (hedefe gidiyor mu, siperde mi, komsu sayisi)
// kaydedilir — kok-neden icin. Determinist (RNG yok).
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const SEED = Number(arg('--seed', 202));
const SANIYE = Number(arg('--saniye', 100));
const OUT = arg('--out', 'qa-runtime/titreme.json');

const { ctx } = tezgahKur();

const kod = [
    '(() => {',
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
    'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;',
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
    'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
    'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
    'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + SEED + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"tt", ally:true });',
    'startBattle();',
    // 0.5sn = 10 tik. 100sn = 200 goruntu.
    'const ADIM = 10, HEDEF = ' + (SANIYE * 20) + ';',
    'const iz = {};',   // id -> [{t,x,y,tip,hedefli,siper,komsu}]  (0.5sn — baglam)
    // ── TIK COZUNURLUGU (50ms): GORULEN titreme yuksek frekanslidir; 0.5sn'de ortalanip KAYBOLUR.
    // Her tik yon tersinmesi sayilir (>120 derece, >0.3px). Saniyede birkac tersinme = gozle titreme.
    'const tik = {};',   // id -> { ters, hrk, sonAci, toplamYol, mikroTers }
    'const ph = SIM.headless; SIM.headless = true; let st = 0;',
    'const _oncekiKonum = {};',
    'try { while (SIM.tick < HEDEF && phase === PHASE.BATTLE) {',
    '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
    '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
    // — her tik: yon tersinmesi —
    '  for (const u of SIM.units) {',
    '    if (u.dead || u.loaded) continue;',
    '    const o = _oncekiKonum[u.id];',
    '    _oncekiKonum[u.id] = { x: u.x, y: u.y };',
    '    if (!o) continue;',
    '    const dx = u.x - o.x, dy = u.y - o.y, d = Math.hypot(dx, dy);',
    '    const s = tik[u.id] = tik[u.id] || { ters: 0, hrk: 0, sonAci: null, yol: 0, tip: (STATS[u.type]||{}).id || String(u.type), kirmizi: !!u.isRed };',
    '    s.yol += d;',
    '    if (d < 0.3) { s.sonAci = null; continue; }',
    '    s.hrk++;',
    '    const aci = Math.atan2(dy, dx);',
    '    if (s.sonAci != null) {',
    '      let f = Math.abs(aci - s.sonAci);',
    '      while (f > Math.PI) f = Math.PI * 2 - f;',
    '      if (f > 2.0944) s.ters++;',   // 120 derece
    '    }',
    '    s.sonAci = aci;',
    '  }',
    '  if (SIM.tick % ADIM) continue;',
    '  for (const u of SIM.units) {',
    '    if (u.dead || u.loaded) continue;',
    '    let komsu = 0;',
    '    for (const n of SIM.spatialGrid.getNearby(u.x, u.y, 60)) {',
    '      if (n.dead || n.loaded || n.id === u.id || n.isRed !== u.isRed) continue;',
    '      if (Math.hypot(n.x - u.x, n.y - u.y) <= 60) komsu++;',
    '    }',
    '    (iz[u.id] = iz[u.id] || []).push({ t: SIM.tick, x: +u.x.toFixed(2), y: +u.y.toFixed(2),',
    '      tip: (STATS[u.type] || {}).id || String(u.type), kirmizi: !!u.isRed,',
    '      hedefli: !!u.isMovingToManualTarget, siper: !!u.inTrench, hava: !!u.isAir,',
    '      baski: Math.round(u.suppression || 0), komsu: komsu });',
    '  }',
    '} } finally { SIM.headless = ph; }',
    'return JSON.stringify({ iz: iz, tikIstat: tik, tik: SIM.tick });',
    '})()'
].join('');

const ham = JSON.parse(vm.runInContext(kod, ctx, { filename: 'tt.js' }));
const iz = ham.iz;

// ── ANALIZ ──
const ACI_ESIK = 120 * Math.PI / 180;
const HAREKET_ESIK = 2;      // px: bunun altindaki adim "durdu" sayilir (yon hesabi anlamsiz)
const PENCERE = 20;          // 20 goruntu = 10sn

const birimler = [];
for (const id of Object.keys(iz)) {
    const p = iz[id];
    if (p.length < 4) continue;
    let tersinme = 0, hareketliAdim = 0, yol = 0;
    const tersAn = [];
    let onceki = null;
    for (let i = 1; i < p.length; i++) {
        const dx = p[i].x - p[i - 1].x, dy = p[i].y - p[i - 1].y;
        const d = Math.hypot(dx, dy);
        yol += d;
        if (d < HAREKET_ESIK) { onceki = null; continue; }
        hareketliAdim++;
        const aci = Math.atan2(dy, dx);
        if (onceki != null) {
            let fark = Math.abs(aci - onceki);
            while (fark > Math.PI) fark = Math.PI * 2 - fark;
            if (fark > ACI_ESIK) { tersinme++; tersAn.push(p[i]); }
        }
        onceki = aci;
    }
    // yol / net yerdegistirme (pencere basina en kotusu)
    let enKotuOran = 1;
    for (let i = 0; i + PENCERE < p.length; i += PENCERE) {
        let y = 0;
        for (let j = i + 1; j <= i + PENCERE; j++) y += Math.hypot(p[j].x - p[j - 1].x, p[j].y - p[j - 1].y);
        const net = Math.hypot(p[i + PENCERE].x - p[i].x, p[i + PENCERE].y - p[i].y);
        if (y > 40 && net > 0.5) enKotuOran = Math.max(enKotuOran, y / net);
        else if (y > 40) enKotuOran = Math.max(enKotuOran, 99);   // hic ilerlememis ama cok yol katetmis
    }
    const s = p[p.length - 1];
    birimler.push({
        id: +id, tip: s.tip, kirmizi: s.kirmizi, hava: s.hava,
        goruntu: p.length, hareketliAdim, tersinme,
        tersOran: hareketliAdim ? tersinme / hareketliAdim : 0,
        yol: Math.round(yol), enKotuOran: +enKotuOran.toFixed(1),
        ortKomsu: +(p.reduce((a, x) => a + x.komsu, 0) / p.length).toFixed(1),
        hedefliPct: Math.round(p.filter(x => x.hedefli).length / p.length * 100),
        ornekTersAn: tersAn.slice(0, 3)
    });
}

birimler.sort((a, b) => b.tersOran - a.tersOran || b.enKotuOran - a.enKotuOran);
const hareketli = birimler.filter(b => b.hareketliAdim >= 5);
const titreyen = hareketli.filter(b => b.tersOran >= 0.30 || b.enKotuOran >= 3);

// ── ONCE TIK COZUNURLUGU: GORULEN titreme burada olculur ──
const T = ham.tikIstat || {};
const tikSat = Object.entries(T).map(([id, s]) => ({
    id: +id, tip: s.tip, kirmizi: s.kirmizi, ters: s.ters, hrk: s.hrk, yol: Math.round(s.yol),
    tersOran: s.hrk ? s.ters / s.hrk : 0,
    tersSaniye: +(s.ters / SANIYE).toFixed(2)
})).filter(x => x.hrk >= 20).sort((a, b) => b.tersSaniye - a.tersSaniye);

console.log('TITREME TESHISI — tohum ' + SEED + ', ' + SANIYE + 'sn');
console.log('');
console.log('=== TIK COZUNURLUGU (50ms) — GORULEN titreme burada olculur ===');
console.log('  gozle titreme = saniyede birkac YON TERSINMESI (>120 derece). 0.5sn ornekte ORTALANIP kaybolur.');
console.log('');
console.log('  ' + 'birim'.padEnd(22) + 'taraf'.padStart(7) + 'ters/hareketli-tik'.padStart(20) +
    'ters%'.padStart(8) + 'ters/sn'.padStart(9) + 'yol px'.padStart(9));
for (const b of tikSat.slice(0, 12)) {
    console.log('  ' + (b.tip + '#' + b.id).padEnd(22) + (b.kirmizi ? 'KIRMIZI' : 'MAVI').padStart(7) +
        (b.ters + '/' + b.hrk).padStart(20) + ('%' + Math.round(b.tersOran * 100)).padStart(8) +
        String(b.tersSaniye).padStart(9) + String(b.yol).padStart(9));
}
{
    const tt = tikSat.filter(x => x.tersSaniye >= 1);
    console.log('');
    console.log('  saniyede >=1 tersinme yasayan birim: ' + tt.length + ' / ' + tikSat.length +
        '   (bu esigi asan birim gozle TITRER)');
    const tipT = {};
    for (const b of tikSat) { const t = tipT[b.tip] = tipT[b.tip] || { n: 0, k: 0, ters: 0, hrk: 0 }; t.n++; t.ters += b.ters; t.hrk += b.hrk; if (b.tersSaniye >= 1) t.k++; }
    console.log('  ' + 'tip'.padEnd(22) + 'birim'.padStart(7) + 'titrek'.padStart(8) + 'ters%'.padStart(8));
    for (const [k, t] of Object.entries(tipT).sort((a, b) => (b[1].ters / Math.max(1, b[1].hrk)) - (a[1].ters / Math.max(1, a[1].hrk))).slice(0, 10))
        console.log('  ' + k.padEnd(22) + String(t.n).padStart(7) + String(t.k).padStart(8) + ('%' + Math.round(t.ters / Math.max(1, t.hrk) * 100)).padStart(8));
}
console.log('');
console.log('=== 0.5sn GORUNTU (baglam — MAKRO salinim; ikmal/kesif icin tasarim geregi olabilir) ===');
console.log('  titreme tanimi: ardisik 0.5sn adimlarinda yon >120 derece dondu (ping-pong),');
console.log('                  ya da 10sn penceresinde yol/net-yerdegistirme >= 3 (yerinde debelenme)');
console.log('');
console.log('  birim (hareket eden): ' + hareketli.length + ' / ' + birimler.length);
console.log('  TITREYEN            : ' + titreyen.length + '  (%' +
    (hareketli.length ? Math.round(titreyen.length / hareketli.length * 100) : 0) + ')');
console.log('');
console.log('  ' + 'birim'.padEnd(20) + 'taraf'.padStart(7) + 'ters/hareket'.padStart(14) +
    'ters%'.padStart(8) + 'yol/net'.padStart(9) + 'komsu'.padStart(7) + 'emirli%'.padStart(9));
for (const b of titreyen.slice(0, 15)) {
    console.log('  ' + (b.tip + '#' + b.id).padEnd(20) + (b.kirmizi ? 'KIRMIZI' : 'MAVI').padStart(7) +
        (b.tersinme + '/' + b.hareketliAdim).padStart(14) +
        ('%' + Math.round(b.tersOran * 100)).padStart(8) +
        String(b.enKotuOran).padStart(9) + String(b.ortKomsu).padStart(7) +
        ('%' + b.hedefliPct).padStart(9));
}
console.log('');
// TIP BAZINDA
const tip = {};
for (const b of hareketli) {
    const t = tip[b.tip] = tip[b.tip] || { n: 0, titrek: 0, ters: 0, hrk: 0, komsu: 0 };
    t.n++; t.ters += b.tersinme; t.hrk += b.hareketliAdim; t.komsu += b.ortKomsu;
    if (b.tersOran >= 0.30 || b.enKotuOran >= 3) t.titrek++;
}
console.log('  TIP BAZINDA:');
console.log('  ' + 'tip'.padEnd(20) + 'birim'.padStart(7) + 'titreyen'.padStart(10) + 'ters%'.padStart(8) + 'ort.komsu'.padStart(11));
for (const [k, t] of Object.entries(tip).sort((a, b) => (b[1].titrek / b[1].n) - (a[1].titrek / a[1].n))) {
    console.log('  ' + k.padEnd(20) + String(t.n).padStart(7) + String(t.titrek).padStart(10) +
        ('%' + Math.round(t.ters / Math.max(1, t.hrk) * 100)).padStart(8) +
        (t.komsu / t.n).toFixed(1).padStart(11));
}
fs.writeFileSync(OUT, JSON.stringify({ seed: SEED, saniye: SANIYE, birimler, iz }, null, 1));
console.log('');
console.log('  ham iz -> ' + OUT + '  (0.5sn konumlari; kok-neden icin tik-tik izlenebilir)');
