// BALISTIK FUZENIN TEK MERMISINE NE OLUYOR? (saglik raporu #1: 1050 TL, getiri x0)
// Birim %100 hedefli, 1 atis yapiyor, 365sn yasiyor - ama HICBIR SEY OLDURMUYOR.
// Uc ihtimal ayrilir:
//   (a) MERMI ONLENIYOR      -> dusman SAM nokta-savunmasi kesiyor (weapon.interceptable=true)
//   (b) MERMI VARIYOR ama az hasar -> 600 hasar splash icinde dagiliyor, kimse olmuyor
//   (c) MERMI HIC ATILMIYOR / bosa gidiyor
// Olcum: LAUNCH / INTERCEPT / patlama olaylari + varista yaricaptaki dusmanlarin HP degisimi.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const { ctx } = tezgahKur();
const fs = require('fs');

// --kesif N : orduya N adet kesif birimi ZORUNLU kil (gozcu hipotezini sinamak icin)
const _ki = process.argv.indexOf('--kesif');
const KESIF = _ki >= 0 ? Number(process.argv[_ki + 1]) : 0;
const NOSPOT = process.argv.includes('--nospotter');   // IZOLE kontrol: pro acik ama spotterRequirement KAPALI
const _si = process.argv.indexOf('--seeds');
const TOHUMLAR = _si >= 0 ? process.argv[_si + 1].split(',').map(Number) : [2024, 3141, 777, 11, 202, 333];

const kod = [
    '(() => {',
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
    'BATTLE_INTEL4PRO_DELTAS.spotterRequirement = ' + (!NOSPOT) + ';',
    'const cikti = [];',
    'for (const seed of ' + JSON.stringify(TOHUMLAR) + ') {',
    '  BATTLE_RECIPE_RED = { ad:"BAL", rol:"attacker", zorunlu: ' + JSON.stringify(Object.assign({ ballistic_missile: 1 }, KESIF > 0 ? { recon_uav: KESIF, scout_vehicle: KESIF } : {})) + ', tavan:{}, artik:[] };',
    '  openBattlefieldSession({ mode:"quick", mapId:-2, seed, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    '  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"bm", ally:true });',
    '  startBattle();',
    '  const BT = Object.keys(STATS).map(Number).find(k => STATS[k] && STATS[k].id === "ballistic_missile");',
    '  const bul = () => SIM.units.find(u => u.type === BT && u.isRed && !u.dead);',
    '  const b0 = bul();',
    '  const w = STATS[BT].weapons[0];',
    '  const kayit = { seed, hasar: w.damage, aoe: Math.round(w.aoe||0), atisTik:null, varisTik:null,',
    '    onlendi:false, hedefTip:null, hedefMesafe:null, aoeIcinde:0, toplamHpDusus:0, olen:0, kalanAmmo:null, banttaTik:0, gorunurTik:0, hazirTik:0, ilkGorunurTik:null };',
    '  let onceki = b0 ? b0.ammo : 0;',
    '  let hpOnce = null, patlamaX = null, patlamaY = null, bekle = 0;',
    '  const ph = SIM.headless; SIM.headless = true; let st = 0;',
    '  try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
    '    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
    '    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
    '    const u = bul();',
    '    if (u && u.ammo > 0) {',
    '      const minR = STATS[BT].minRange || 0;',
    '      let banttaVar = false, gorunurVar = false;',
    '      for (const e of SIM.units) { if (e.dead || e.loaded || e.isRed) continue;',
    '        const d = Math.hypot(e.x-u.x, e.y-u.y);',
    '        if (d < minR || d > u.range) continue;',
    '        banttaVar = true;',
    '        if ((d <= u.vision) || canSee(u.isRed, e.x, e.y, e.isAir)) { gorunurVar = true; break; } }',
    '      if (banttaVar) kayit.banttaTik++;',
    '      if (gorunurVar) { kayit.gorunurTik++; if (kayit.ilkGorunurTik === null) kayit.ilkGorunurTik = SIM.tick; }',
    '      kayit.hazirTik++;',
    '    }',
    '    if (u && kayit.atisTik === null && u.ammo < onceki) {',
    '      kayit.atisTik = SIM.tick; kayit.kalanAmmo = u.ammo;',
    '      const t = u.attackTarget;',
    '      if (t) { kayit.hedefTip = (STATS[t.type]||{}).id || null;',
    '        kayit.hedefMesafe = Math.round(Math.hypot(t.x-u.x, t.y-u.y));',
    '        patlamaX = t.x; patlamaY = t.y;',
    '        const R = (w.aoe||0);',
    '        hpOnce = 0; kayit.aoeIcinde = 0;',
    '        for (const e of SIM.units) { if (e.dead || e.isRed) continue;',
    '          if (Math.hypot(e.x-patlamaX, e.y-patlamaY) <= R) { hpOnce += e.hp; kayit.aoeIcinde++; } }',
    '      }',
    '      bekle = 1;',
    '    }',
    '    if (u) onceki = u.ammo;',
    // varis: mermi ucus kuyrugunda mi, onlendi mi
    '    if (bekle > 0) {',
    '      bekle++;',
    '      if (bekle > 60 && hpOnce !== null && kayit.varisTik === null) {',
    '        kayit.varisTik = SIM.tick;',
    '        const R = (w.aoe||0);',
    '        let hpSonra = 0, sag = 0;',
    '        for (const e of SIM.units) { if (e.isRed) continue;',
    '          if (Math.hypot(e.x-patlamaX, e.y-patlamaY) <= R) { if (!e.dead) { hpSonra += e.hp; sag++; } } }',
    '        kayit.toplamHpDusus = Math.round(hpOnce - hpSonra);',
    '        kayit.olen = kayit.aoeIcinde - sag;',
    '        bekle = 0;',
    '      }',
    '    }',
    '  } } finally { SIM.headless = ph; }',
    '  cikti.push(kayit);',
    '}',
    'return JSON.stringify(cikti);',
    '})()'
].join('');

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'bm.js' }));
console.log('BALISTIK MERMI TESHISI — ' + r.length + ' tohum   (silah hasari ' + r[0].hasar + ', patlama yaricapi ' + r[0].aoe + 'px)');
console.log('');
console.log('  tohum'.padEnd(9) + 'atis'.padStart(8) + ' ilkGorunur'.padStart(12) + '  bantta%'.padStart(9) + ' gorunur%'.padStart(10) + '  hedef'.padStart(16) + '  HPdusus'.padStart(9) + '  OLEN'.padStart(6));
let toplamOlen = 0, toplamHp = 0, atmayan = 0;
for (const x of r) {
    const pb = x.hazirTik ? '%' + Math.round(x.banttaTik / x.hazirTik * 100) : '-';
    const pg = x.hazirTik ? '%' + Math.round(x.gorunurTik / x.hazirTik * 100) : '-';
    const ig = x.ilkGorunurTik != null ? Math.round(x.ilkGorunurTik * 0.05) + 'sn' : 'HIC';
    if (x.atisTik === null) atmayan++; else { toplamOlen += x.olen; toplamHp += x.toplamHpDusus; }
    console.log('  ' + String(x.seed).padEnd(9) + (x.atisTik != null ? Math.round(x.atisTik * 0.05) + 'sn' : 'YOK').padStart(8) +
        ig.padStart(12) + pb.padStart(9) + pg.padStart(10) +
        String(x.hedefTip || '-').padStart(16) +
        (x.atisTik != null ? String(x.toplamHpDusus) : '-').padStart(9) +
        (x.atisTik != null ? String(x.olen) : '-').padStart(6));
}
console.log('');
console.log('  hic ates etmeyen : ' + atmayan + '/' + r.length);
console.log('  TOPLAM olen birim: ' + toplamOlen + '   toplam HP dususu: ' + toplamHp);
console.log('  -> HP dususu ~0 ise MERMI VARMIYOR (onleme/iskalama). HP dusuyor ama olen 0 ise HASAR YETMIYOR.');
