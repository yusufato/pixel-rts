// JAMMER KONUM TESHISI (beceri #29)
// Kullanici: "guclu bir arac ama jammeri iyi konuslandiramiyor muhtemelen." -> OLC.
// Sorular:
//   (a) dusman dron tiklerinin yuzde kaci HERHANGI bir dost jam baloncugunun icinde? (KAPSAMA)
//   (b) jammer en yakin dusman drona ortalama ne kadar uzak?
//   (c) jammer nerede duruyor - kendi kutlesiyle mi, hatta mi, geride mi?
//   (d) jammer yasiyor mu (silahsiz, 300hp) - one gitmek olduruyor mu?
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const { ctx } = tezgahKur();
const _si = process.argv.indexOf('--seed');
const SEED = _si >= 0 ? Number(process.argv[_si + 1]) : 2024;
const KONUM = process.argv.includes('--konum');   // beceri ACIK mi
const _pa = (b, v) => { const i = process.argv.indexOf(b); return i >= 0 ? Number(process.argv[i + 1]) : v; };
const TEHDIT = _pa('--tehdit', null), DERIN = _pa('--derinlik', null), ICERI = _pa('--iceri', null);
const t = JSON.parse(require('fs').readFileSync('qa-runtime/jammer-test2.json', 'utf8'));
const sal = t.find(x => x.ad === 'SAL-DRONCU'), sav = t.find(x => x.ad === 'SAV-JAMMERLI');

const kod = '(() => {' +
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
    // IZOLE A/B: pro HER IKI KOLDA da acik; degisen TEK sey jammerPost anahtari.
    // (Onceki kurulum pro'yu KONUM ile birlikte aciyordu -> fark tum deltalara aitti. Kanit:
    //  baglama:0 olan kosu bile tabandan farkli cikmisti.)
    'BATTLE_INTEL4PRO_BLUE = true; BATTLE_BALANCE.on = true;' +          // savunan = jammer sahibi
    'BATTLE_INTEL4PRO_DELTAS.jammerPost = ' + KONUM + ';' +
    (TEHDIT != null ? 'PRO_JAM_TEHDIT = ' + TEHDIT + ';' : '') +
    (DERIN != null ? 'PRO_JAM_DERINLIK = ' + DERIN + ';' : '') +
    (ICERI != null ? 'PRO_JAM_ICERI = ' + ICERI + ';' : '') +
    // KIRMIZI (saldiran, dron-agirlikli): openBattlefieldSession BATTLE_RECIPE_RED'den KENDI kurar - elle deploy YOK (cift ordu olur).
    'BATTLE_RECIPE_RED = ' + JSON.stringify(sal) + ';' +
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + SEED + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
    // MAVI (savunan, jammerli): elle kurulur ve tarif MUTLAKA `recipe:` ile gecilmeli - yoksa sezgisel ordu gelir.
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false, recipe: ' + JSON.stringify(sav) + ' }), false, { source:"jk", ally:true });' +
    'startBattle();' +
    'const TP = (typeof TILE_PX !== "undefined") ? TILE_PX : 35;' +
    'let dronTik = 0, kapsanan = 0, mesafeSum = 0, mesafeN = 0;' +
    'let jamKutleSum = 0, jamKutleN = 0, jamDerinlikSum = 0, jamDerinlikN = 0;' +
    'const jamOlum = []; const jamIds = new Set();' +
    'for (const u of SIM.units) { const a = STATS[u.type] && STATS[u.type].aura; if (a && a.type === "jamming") jamIds.add(u.id); }' +
    'const ph = SIM.headless; SIM.headless = true; let st = 0;' +
    'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {' +
    '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
    '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
    '  const jammerlar = SIM.units.filter(u => jamIds.has(u.id) && !u.dead);' +
    '  for (const id of jamIds) { const j = SIM.units.find(x => x.id === id);' +
    '    if (j && j.dead && !jamOlum.some(o => o.id === id)) jamOlum.push({ id, tik: SIM.tick }); }' +
    '  if (SIM.tick % 10 !== 0) continue;' +              // 0.5sn ornekleme
    '  for (const d of SIM.units) { if (d.dead || d.loaded || !d.jammable) continue;' +
    '    if (jammerlar.length && d.isRed === jammerlar[0].isRed) continue;' +   // yalniz DUSMAN dronu
    '    dronTik++;' +
    '    let en = Infinity, ortuldu = false;' +
    '    for (const j of jammerlar) { const a = STATS[j.type].aura; const rr = (a.radius || 3) * TP;' +
    '      const dd = Math.hypot(j.x - d.x, j.y - d.y); if (dd < en) en = dd; if (dd <= rr) ortuldu = true; }' +
    '    if (ortuldu) kapsanan++;' +
    '    if (en < Infinity) { mesafeSum += en; mesafeN++; } }' +
    '  for (const j of jammerlar) {' +                    // jammer kendi kutlesine ne kadar yakin / ne kadar derinde
    '    let dostSum = 0, dostN = 0;' +
    '    for (const f of SIM.units) { if (f.dead || f.loaded || f.isRed !== j.isRed || f === j) continue;' +
    '      dostSum += Math.hypot(f.x - j.x, f.y - j.y); dostN++; }' +
    '    if (dostN) { jamKutleSum += dostSum / dostN; jamKutleN++; }' +
    '    jamDerinlikSum += (j.isRed ? j.y / WORLD_H : 1 - j.y / WORLD_H); jamDerinlikN++; }' +
    '} } finally { SIM.headless = ph; }' +
    'return JSON.stringify({ dronTik, kapsanan, ortMesafe: mesafeN ? mesafeSum / mesafeN : null,' +
    '  ortKutleMesafe: jamKutleN ? jamKutleSum / jamKutleN : null,' +
    '  ortDerinlik: jamDerinlikN ? jamDerinlikSum / jamDerinlikN : null,' +
    '  jamSayi: jamIds.size, jamOlum, bitisTik: SIM.tick, yaricap: (STATS[Object.keys(STATS).find(k => STATS[k].aura && STATS[k].aura.type === "jamming")].aura.radius) * TP,' +
    '  bind: (typeof BATTLE_BALANCE !== "undefined" && BATTLE_BALANCE.jammerPostBind) || 0 });' +
    '})()';

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'jamkonum.js' }));
console.log('JAMMER KONUM TESHISI — seed' + SEED + '   [beceri: ' + (KONUM ? 'ACIK' : 'kapali') + ']   mac ' + Math.round(r.bitisTik * 0.05) + 'sn');
console.log('  jammerPost baglama   : ' + r.bind + ' tik');
console.log('  jammer sayisi        : ' + r.jamSayi + '   yaricap ' + Math.round(r.yaricap) + 'px');
console.log('  olen jammer          : ' + (r.jamOlum.length ? r.jamOlum.map(o => Math.round(o.tik * 0.05) + 'sn').join(', ') : 'yok'));
console.log('');
console.log('  (a) KAPSAMA          : ' + r.kapsanan + '/' + r.dronTik + ' dusman-dron ornegi baloncukta = %' +
    (r.dronTik ? Math.round(r.kapsanan / r.dronTik * 1000) / 10 : 0));
console.log('  (b) jammer->en yakin dusman dron ort. mesafe: ' + (r.ortMesafe != null ? Math.round(r.ortMesafe) + 'px' : '-') +
    '   (baloncuk ' + Math.round(r.yaricap) + 'px)');
console.log('  (c) jammer->kendi kutlesi ort. mesafe       : ' + (r.ortKutleMesafe != null ? Math.round(r.ortKutleMesafe) + 'px' : '-'));
console.log('  (d) jammer derinligi (0=kendi ussu, 1=dusman): ' + (r.ortDerinlik != null ? (Math.round(r.ortDerinlik * 100) / 100) : '-'));
