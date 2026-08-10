// YAKIN-KONUM EMRI — TIP TARAMASI
//
// Kusur (kullanici, 2026-08-09): "birligi kendine cok yakin bir konuma gondermeye calistigimda
// gitmiyor." Mesafe taramasi (tools/yakin-emir-teshis.js) TOPCU icin kusuru URETMEDI → demek ki
// sorun MESAFEDE degil, BIRIM TIPINDE: bazi tiplerin kendi otomatigi (ikmal/tamir/tasima/dron/
// helo-usse-donus) oyuncunun targetX'ini her tik EZIYOR olabilir.
//
// Bu arac oyuncunun sahip olabilecegi HER tipten bir birim alir, PLAYER kontrolune verir, temiz bir
// noktaya oturtur ve 60 px otesine player-move verir. Kontrolor CANLI kosar (gercek oyun yolu).
// Cikti: hangi tip emri tutuyor, hangisi tutmuyor + emri hangi tikte kaybetti.
//
// Kullanim: node tools/yakin-emir-tip.js [--mesafe 60] [--tik 60]
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const D = Number(arg('--mesafe', 60));
const TIK = Number(arg('--tik', 60));

const { ctx } = tezgahKur();

const kod = [
    '(() => {',
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:202, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, isAttacker:true }), false, { source:"yt" });',
    'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
    'startBattle();',
    'for (const u of SIM.units) if (!u.isRed) u.controlOwner = "PLAYER";',
    'const ph = SIM.headless; SIM.headless = true;',
    // her tipten ILK birim
    'const gorulen = {}; const denek = [];',
    'for (const u of SIM.units) { if (u.isRed || u.dead) continue; if (gorulen[u.type]) continue; gorulen[u.type] = 1; denek.push(u); }',
    'const sonuc = []; let st = 0;',
    'for (const u of denek) {',
    // Temiz nokta: kendi yarisinda, dusmandan uzak; her denek ayri seride oldugu icin ust uste binmesin.
    // TUZAK (yasandi): izgaradaki bazi hucreler SU/DAG cikiyor. Birimi oraya oturtursan carpisma cozumu
    // onu son gecilebilir noktasina GERI ISINLIYOR ve arac "emri tutmadi" gibi gorunuyor — SAHTE POZITIF.
    // Bu yuzden slot gecilebilir olana kadar saga kaydirilir.
    '  let bx = 700 + (sonuc.length % 6) * 600, by = 2700 + Math.floor(sonuc.length / 6) * 200;',
    '  for (let k = 0; k < 40 && typeof isPassableAt === "function" && (!isPassableAt(bx, by) || !isPassableAt(bx + ' + D + ', by)); k++) bx += 60;',
    '  u.x = bx; u.y = by; u.targetX = bx; u.targetY = by;',
    '  u.manualMoveTarget = null; u.isMovingToManualTarget = false; u.attackTarget = null; u.manualTarget = null;',
    '  u._holdingPos = true; u._navPath = null; u._unstickPoint = null;',
    '  const hx = bx + ' + D + ', hy = by;',
    '  battleApplyRecordedEvent({ type:"player-move", payload:{ destinations:[{ id:u.id, x:hx, y:hy }] } });',
    '  const eX = u.targetX, eY = u.targetY;',
    '  let dustu = -1, yol = 0, px = u.x, py = u.y; let _kim = null;',
    '  for (let t = 0; t < ' + TIK + '; t++) {',
    '    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
    '    yol += Math.hypot(u.x - px, u.y - py); px = u.x; py = u.y;',
    '    if (dustu < 0 && (Math.abs(u.targetX - eX) > 2 || Math.abs(u.targetY - eY) > 2)) { dustu = t;',
    '      _kim = { tx: Math.round(u.targetX), ty: Math.round(u.targetY), kac: !!u.isFleeing, usse: !!u._returningToBase,',
    '        hedef: u.attackTarget ? ((STATS[u.attackTarget.type]||{}).id || u.attackTarget.type) : null,',
    '        manuel: !!u.manualTarget, mmt: u.manualMoveTarget ? [Math.round(u.manualMoveTarget.x), Math.round(u.manualMoveTarget.y)] : null,',
    '        unstick: !!u._unstickPoint, bastir: Math.round(u.suppression || 0), ctrl: u.controlOwner }; }',
    '    if (u.dead) break;',
    '  }',
    '  sonuc.push({ tip: (STATS[u.type]||{}).id || String(u.type), hiz: +(u.speed||0).toFixed(2),',
    '    kalan: +Math.hypot(u.x - hx, u.y - hy).toFixed(1), net: +Math.hypot(u.x - bx, u.y - by).toFixed(1),',
    '    yol: +yol.toFixed(1), emirDustu: dustu, olu: !!u.dead, kim: _kim });',
    '}',
    'SIM.headless = ph;',
    'return JSON.stringify(sonuc);',
    '})()'
].join('\n');

const s = JSON.parse(vm.runInContext(kod, ctx, { filename: 'yakintip.js' }));
const yeterliMesafe = Math.max(6, D * 0.15);
console.log('\nYAKIN-KONUM EMRI — TIP TARAMASI (' + D + ' px saga, ' + TIK + ' tik, kontrolor CANLI)');
console.log('  tip                      hiz  kalan    net    yol  emirDustu  sonuc');
let kotu = 0;
for (const r of s) {
    const ok = r.olu ? 'oldu (sayilmaz)' : (r.kalan <= yeterliMesafe ? 'VARDI' : (r.net < 2 ? '*** KIMILDAMADI ***' : '*** EKSIK ***'));
    if (!r.olu && r.kalan > yeterliMesafe) kotu++;
    console.log('  ' + r.tip.padEnd(22) + String(r.hiz).padStart(5) + String(r.kalan).padStart(7) +
        String(r.net).padStart(7) + String(r.yol).padStart(7) + String(r.emirDustu).padStart(10) + '  ' + ok);
    if (r.kim) console.log('        emri EZEN durum: ' + JSON.stringify(r.kim));
}
console.log('\n  emri TUTMAYAN tip sayisi: ' + kotu + ' / ' + s.length);
