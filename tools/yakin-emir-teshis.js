// YAKIN-KONUM EMRI TESHISI (kullanici: "birligi kendine cok yakin bir konuma gondermeye
// calistigimda gitmiyor" — _holdingPos sifirlamasi YETMEDI, IKINCI bir esik var).
//
// TAHMIN ETME, OLC: birimi sabit bir noktaya oturt, sonra player-move ile N px otesine emir ver ve
// 60 tik (3 sn) boyunca izle. Her mesafe icin: gercekten kat edilen yol, hedefe kalan mesafe,
// ve emrin hangi tikte DUSTUGU (targetX artik emredilen nokta degil).
//
// Kullanim: node tools/yakin-emir-teshis.js [--mesafe 10,20,30,...] [--kalabalik]
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MESAFELER = String(arg('--mesafe', '8,14,20,26,32,40,55,70,100,150')).split(',').map(Number);
const KALABALIK = process.argv.includes('--kalabalik');   // birimin dibine 4 dost koy (carpisma itmesi devrede)
// --dolu: HEDEF NOKTADA duran bir DOST var (kullanicinin tarif ettigi "birim dibine emir" durumu).
// Beklenen kusur: carpisma A'yi MIN_DIST'ten iceri sokmaz, ama varis esigi (hiz+1 px) cok kucuk
// oldugu icin birim "vardim" diyemez → sonsuza dek iter/itilir (hem emir tutmaz hem TITREME).
const DOLU = process.argv.includes('--dolu');
const TIK = Number(arg('--tik', 60));

const { ctx } = tezgahKur();

const kod = [
    '(() => {',
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:202, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, isAttacker:true }), false, { source:"ye" });',
    'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
    'startBattle();',
    'for (const u of SIM.units) if (!u.isRed) u.controlOwner = "PLAYER";',   // oyuncunun EL ile surdugu birimler
    'const ph = SIM.headless; SIM.headless = true;',
    'const sonuc = [];',
    'const MES = ' + JSON.stringify(MESAFELER) + ';',
    'const KAL = ' + (KALABALIK ? 'true' : 'false') + ';',
    'const DOL = ' + (DOLU ? 'true' : 'false') + ';',
    // Denek: oyuncunun (mavi) bir kara birimi. Dusmandan UZAK bir kose sec ki angajman karismasin.
    // EN HIZLI kara birimi denek: varis esigi hiza baglidir (movementSpeed+1), kusur once orada gorunur.
    'const denek = SIM.units.filter(u => !u.isRed && !u.dead && !u.isAir).sort((a,b) => (b.speed - a.speed) || (a.id - b.id));',
    'let st = 0;',
    'for (const D of MES) {',
    '  const u = denek[0];',
    '  if (!u) break;',
    // her turda birimi ayni temiz noktaya oturt
    '  u.x = 1500; u.y = 2800; u.targetX = u.x; u.targetY = u.y;',
    '  u.manualMoveTarget = null; u.isMovingToManualTarget = false; u.attackTarget = null; u.manualTarget = null;',
    '  u._holdingPos = true; u._navPath = null; u._unstickPoint = null;',
    '  const komsu = [];',
    '  if (KAL) { let k = 0; for (const o of denek) { if (o === u || k >= 4) continue; o.x = u.x + [40,-40,0,0][k]; o.y = u.y + [0,0,40,-40][k]; o.targetX = o.x; o.targetY = o.y; o.manualMoveTarget = null; o.isMovingToManualTarget = false; o._holdingPos = true; komsu.push(o); k++; } }',
    '  const bx = u.x, by = u.y;',
    '  const hx = u.x + D, hy = u.y;',                          // saga D px
    '  let isgal = null;',
    '  if (DOL) { for (const o of denek) { if (o === u) continue; isgal = o; break; } }',
    '  if (isgal) { isgal.x = hx; isgal.y = hy; isgal.targetX = hx; isgal.targetY = hy; isgal.manualMoveTarget = null; isgal.isMovingToManualTarget = false; isgal._holdingPos = true; isgal.attackTarget = null; isgal.manualTarget = null; }',
    '  battleApplyRecordedEvent({ type:"player-move", payload:{ destinations:[{ id:u.id, x:hx, y:hy }] } });',
    '  const emirX = u.targetX, emirY = u.targetY;',
    '  let yol = 0, px = u.x, py = u.y, dustu = -1, ilkTik = -1;',
    '  const igx = isgal ? isgal.x : 0, igy = isgal ? isgal.y : 0;',
    '  let sonAci = null, ters = 0;',
    '  for (let t = 0; t < ' + TIK + '; t++) {',
    '    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, null, false);',   // KONTROLOR YOK: yalniz birim mantigi
    '    const d = Math.hypot(u.x - px, u.y - py); const _a = Math.atan2(u.y - py, u.x - px);',
    '    if (d > 0.3) { if (sonAci != null) { let f = Math.abs(_a - sonAci); while (f > Math.PI) f = Math.PI * 2 - f; if (f > 2.0944) ters++; } sonAci = _a; } else sonAci = null;',
    '    yol += d; px = u.x; py = u.y;',
    '    if (ilkTik < 0 && d > 0.5) ilkTik = t;',
    '    if (dustu < 0 && (Math.abs(u.targetX - emirX) > 1 || Math.abs(u.targetY - emirY) > 1)) dustu = t;',
    '  }',
    '  sonuc.push({ mesafe: D, yol: +yol.toFixed(2), kalan: +Math.hypot(u.x - hx, u.y - hy).toFixed(2),',
    '    netYer: +Math.hypot(u.x - bx, u.y - by).toFixed(2), ilkTik: ilkTik, emirDustu: dustu,',
    '    hold: !!u._holdingPos, ters: ters, isgalKay: isgal ? +Math.hypot(isgal.x - igx, isgal.y - igy).toFixed(2) : 0,',
    '    tip: (STATS[u.type]||{}).id, hiz: +(u.speed).toFixed(2) });',
    '}',
    'SIM.headless = ph;',
    'return JSON.stringify(sonuc);',
    '})()'
].join('\n');

const s = JSON.parse(vm.runInContext(kod, ctx, { filename: 'yakinemir.js' }));
const KIP = DOLU ? 'HEDEFTE DOST DURUYOR' : (KALABALIK ? 'KALABALIK (4 dost dibinde)' : 'TEK BASINA');
console.log('\nYAKIN-KONUM EMRI — ' + KIP + ', ' + TIK + ' tik');
console.log('  birim: ' + (s[0] ? s[0].tip + '  hiz/tik ' + s[0].hiz : '-'));
console.log('  mesafe  netYer   kalan    yol   ilkTik  hold  ters  isgalKay  sonuc');
for (const r of s) {
    const ok = r.hold ? 'YERLESTI' : (r.netYer < 1 ? '*** HIC KIMILDAMADI ***' : 'DURMUYOR (surekli itiyor)');
    console.log('  ' + String(r.mesafe).padStart(6) + String(r.netYer).padStart(8) +
        String(r.kalan).padStart(8) + String(r.yol).padStart(8) +
        String(r.ilkTik).padStart(8) + String(r.hold ? 'E' : 'H').padStart(6) +
        String(r.ters).padStart(6) + String(r.isgalKay).padStart(10) + '  ' + ok);
}
