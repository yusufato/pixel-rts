// IKMAL ARACI TOPCUNUN YANINDA MI? (kullanici: "topcularin yakininda surekli bir ikmal araci sart")
// resupplyRun (topcuyu ikmale GONDER) K2'de elenmisti. Bu TERSI: aracin topcuya GELMESI.
// Once OLC - AI bunu zaten yapiyor olabilir (jammer semsiyesinde oyle cikmisti).
//   (1) dolayli birim tiklerinin yuzde kaci bir dost ikmal HALESI icinde geciyor?
//   (2) ikmal araci dolayli-kumenin merkezine ne kadar uzak? (hale 400px)
//   (3) ikmal araci nerede duruyor / yasiyor mu?
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const { ctx } = tezgahKur();
const _si = process.argv.indexOf('--seed');
const SEED = _si >= 0 ? Number(process.argv[_si + 1]) : 2024;
const NOESCORT = process.argv.includes('--noescort');

const kod = '(() => {' +
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true; BATTLE_BALANCE.on = true;' +
    'BATTLE_INTEL4PRO_DELTAS.supplyEscort = ' + (!NOESCORT) + ';' +
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + SEED + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"ik", ally:true });' +
    'startBattle();' +
    'const TP = (typeof TILE_PX !== "undefined") ? TILE_PX : 100;' +
    'let dolayliTik = 0, haledeTik = 0, kuruTik = 0, mesafeSum = 0, mesafeN = 0;' +
    'let arac = [], atisTop = 0;' +
    'const oncekiAmmo = new Map();' +
    'const ph = SIM.headless; SIM.headless = true; let st = 0;' +
    'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {' +
    '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
    '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
    '  const kaynaklar = [];' +
    '  for (const u of SIM.units) { if (u.dead || u.isRed) continue; const a = STATS[u.type] && STATS[u.type].aura;' +
    '    if (a && a.type === "resupply") kaynaklar.push({ x:u.x, y:u.y, r:(a.radius||3)*TP }); }' +
    '  let cx = 0, cy = 0, cn = 0;' +
    '  for (const u of SIM.units) { if (u.dead || u.loaded || u.isRed || !u.isIndirect) continue;' +
    '    dolayliTik++; cx += u.x; cy += u.y; cn++;' +
    '    const a0 = oncekiAmmo.get(u.id); if (a0 != null && u.ammo < a0) atisTop += (a0 - u.ammo); oncekiAmmo.set(u.id, u.ammo);' +
    '    if (u.ammo <= 0) kuruTik++;' +
    '    for (const k of kaynaklar) if (Math.hypot(k.x - u.x, k.y - u.y) <= k.r) { haledeTik++; break; } }' +
    '  if (cn && kaynaklar.length && SIM.tick % 10 === 0) {' +
    '    cx /= cn; cy /= cn;' +
    '    let en = Infinity; for (const k of kaynaklar) { const d = Math.hypot(k.x - cx, k.y - cy); if (d < en) en = d; }' +
    '    mesafeSum += en; mesafeN++; }' +
    '} } finally { SIM.headless = ph; }' +
    'for (const u of SIM.units) { const a = STATS[u.type] && STATS[u.type].aura;' +
    '  if (!u.isRed && a && a.type === "resupply") arac.push({ olu: !!u.dead, hale: Math.round((a.radius||3)*TP) }); }' +
    'return JSON.stringify({ dolayliTik, haledeTik, kuruTik, atisTop,' +
    '  ortMesafe: mesafeN ? mesafeSum/mesafeN : null, arac, bind: BATTLE_BALANCE.supplyEscortBind || 0 });' +
    '})()';

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'ik.js' }));
const p = n => r.dolayliTik ? '%' + Math.round(n / r.dolayliTik * 100) : '-';
console.log('IKMAL KONUM TESHISI — seed' + SEED + '   [supplyEscort: ' + (NOESCORT ? 'kapali' : 'ACIK') + ', baglama ' + r.bind + ' tik]');
console.log('  savunan ikmal araci: ' + r.arac.length + (r.arac.length ? '   (hale ' + r.arac[0].hale + 'px, ölen ' + r.arac.filter(a=>a.olu).length + ')' : ''));
console.log('');
console.log('  dolaylı birim tiki        : ' + r.dolayliTik);
console.log('  ikmal HALESİ içinde geçen : ' + r.haledeTik + '  ' + p(r.haledeTik) + '   <- ASIL METRİK');
console.log('  KURU geçen                : ' + r.kuruTik + '  ' + p(r.kuruTik));
console.log('  toplam dolaylı ATIŞ       : ' + Math.round(r.atisTop));
console.log('  ikmal aracı → dolaylı-küme merkezi ort. mesafe: ' + (r.ortMesafe != null ? Math.round(r.ortMesafe) + 'px' : '-'));
