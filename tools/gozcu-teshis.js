// GOZCU TESHISI (beceri #2): uzun menzilli dolayli birim ates edemiyorsa sebebi hangisi?
//   (a) ATIS BANDINDA HEDEF YOK  -> konumlandirma/standoff sorunu
//   (b) BANTTA HEDEF VAR ama GORUNMUYOR -> GOZCU sorunu (gorus 500px < menzil 3000px)
//   (c) banttta gorunur hedef VAR ama yine ates yok -> baska bir mekanik engel
// Bu ayrim yapilmadan "gozcu bagi" yazmak KOR atistir. Once hangisi oldugunu olceriz.
//
// IZOLE kurulum: iki kolda da pro ACIK; --nostandoff kolu yalniz 'standoff' anahtarini kapatir.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const { ctx } = tezgahKur();

const PRO = !process.argv.includes('--nopro');
const NOSTAND = process.argv.includes('--nostandoff');
const NOLOADED = process.argv.includes('--noloaded');   // BATTLE_SPAWN_LOADED kapali kol (mekanik A/B)
const _si = process.argv.indexOf('--seed');
const SEED = _si >= 0 ? Number(process.argv[_si + 1]) : 2024;

const tarif = JSON.parse(require('fs').readFileSync('qa-runtime/adaylar-duman.json', 'utf8'))
    .find(t => t.ad === 'KESIF-balistik-1');

const kod = '(() => {' +
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
    'BATTLE_INTEL4PRO_RED = ' + PRO + '; BATTLE_INTEL4PRO_BLUE = false;' +
    'BATTLE_INTEL4PRO_DELTAS.standoff = ' + (!NOSTAND) + ';' +
    'BATTLE_SPAWN_LOADED = ' + (!NOLOADED) + ';' +
    'BATTLE_RECIPE_RED = ' + JSON.stringify(tarif) + ';' +
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + SEED + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"gozcu", ally:true });' +
    'startBattle();' +
    'const BT = T.BALLISTIC != null ? T.BALLISTIC : Object.keys(STATS).map(Number).find(k => STATS[k] && STATS[k].id === "ballistic_missile");' +
    'const bul = () => SIM.units.find(u => u.type === BT && !u.dead);' +
    // sayaclar: birim CANLI ve MUHIMMATLI iken gecen tiklerin dagilimi
    'let tikCanli = 0, tikBandaHedefYok = 0, tikBandaGorunmez = 0, tikBandaGorunur = 0;' +
    'let ilkGorunurTik = null, enYakinDostBandaSum = 0, enYakinDostBandaN = 0;' +
    'const ornek = [];' +
    'const ph = SIM.headless; SIM.headless = true; let st = 0;' +
    'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {' +
    '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
    '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
    '  const u = bul(); if (!u || u.ammo <= 0) continue;' +
    '  tikCanli++;' +
    '  const s = STATS[u.type]; const minR = s.minRange || 0; const maxR = u.range;' +
    '  let bandaHedef = 0, bandaGorunur = 0, enYakinDost = Infinity, ornekHedef = null;' +
    '  for (const e of SIM.units) {' +
    '    if (e.dead || e.loaded || e.abandoned || e.isRed === u.isRed) continue;' +
    '    const d = Math.hypot(e.x - u.x, e.y - u.y);' +
    '    if (d < minR || d > maxR) continue;' +          // atis bandi disi
    '    bandaHedef++;' +
    '    const gorunur = (d <= u.vision) || canSee(u.isRed, e.x, e.y, e.isAir);' +
    '    if (gorunur) bandaGorunur++;' +
    '    else {' +                                        // gorunmeyen hedefe EN YAKIN dost ne kadar uzakta?
    '      let ed = Infinity;' +
    '      for (const f of SIM.units) { if (f.dead || f.loaded || f.isRed !== u.isRed) continue;' +
    '        const fd = Math.hypot(f.x - e.x, f.y - e.y); if (fd < ed) ed = fd; }' +
    '      if (ed < enYakinDost) { enYakinDost = ed; ornekHedef = { d: Math.round(d), dostMesafe: Math.round(ed), dostGorus: 0 }; }' +
    '    }' +
    '  }' +
    '  if (!bandaHedef) tikBandaHedefYok++;' +
    '  else if (!bandaGorunur) { tikBandaGorunmez++; if (enYakinDost < Infinity) { enYakinDostBandaSum += enYakinDost; enYakinDostBandaN++; } }' +
    '  else { tikBandaGorunur++; if (ilkGorunurTik == null) ilkGorunurTik = SIM.tick; }' +
    '  if (SIM.tick % 600 === 0) ornek.push({ sn: Math.round(SIM.tick*BATTLE_TICK_SEC), bandaHedef, bandaGorunur,' +
    '    enYakinDostMesafe: enYakinDost < Infinity ? Math.round(enYakinDost) : null });' +
    '} } finally { SIM.headless = ph; }' +
    'const u2 = bul();' +
    'return JSON.stringify({ tikCanli, tikBandaHedefYok, tikBandaGorunmez, tikBandaGorunur,' +
    '  ilkGorunurSn: ilkGorunurTik != null ? Math.round(ilkGorunurTik*BATTLE_TICK_SEC) : null,' +
    '  ortDostMesafe: enYakinDostBandaN ? Math.round(enYakinDostBandaSum/enYakinDostBandaN) : null,' +
    '  sagKaldi: !!u2, ornek });' +
    '})()';

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'gozcu.js' }));
const pct = n => r.tikCanli ? (Math.round(n / r.tikCanli * 1000) / 10) + '%' : '-';
console.log('GOZCU TESHISI — balistik, seed' + SEED + '   [pro:' + (PRO ? 'acik' : 'kapali') + '  standoff:' + (PRO && !NOSTAND ? 'ACIK' : 'kapali') + ']');
console.log('  canli+muhimmatli tik : ' + r.tikCanli + '   (birim ' + (r.sagKaldi ? 'sag kaldi' : 'oldu/muhimmati bitti') + ')');
console.log('');
console.log('  ATES EDEMEME SEBEBININ DAGILIMI:');
console.log('    (a) bantta HEDEF YOK      : ' + String(r.tikBandaHedefYok).padStart(5) + '  ' + pct(r.tikBandaHedefYok).padStart(6) + '   -> konumlandirma sorunu');
console.log('    (b) bantta var, GORUNMEZ  : ' + String(r.tikBandaGorunmez).padStart(5) + '  ' + pct(r.tikBandaGorunmez).padStart(6) + '   -> GOZCU sorunu');
console.log('    (c) bantta var, GORUNUR   : ' + String(r.tikBandaGorunur).padStart(5) + '  ' + pct(r.tikBandaGorunur).padStart(6) + '   -> ates edebilirdi');
console.log('');
console.log('  ilk gorunur-hedef ani  : ' + (r.ilkGorunurSn != null ? r.ilkGorunurSn + 'sn' : 'HIC OLMADI'));
console.log('  gorunmeyen hedefe en yakin dost (ort): ' + (r.ortDostMesafe != null ? r.ortDostMesafe + 'px' : '-'));
console.log('');
console.log('  ZAMAN ORNEKLERI (bandaki hedef / gorunen / gorunmeyene en yakin dost):');
for (const o of r.ornek) {
    console.log('    ' + String(o.sn).padStart(4) + 'sn   bant ' + String(o.bandaHedef).padStart(2) +
        '   gorunen ' + String(o.bandaGorunur).padStart(2) +
        '   en yakin dost ' + (o.enYakinDostMesafe != null ? o.enYakinDostMesafe + 'px' : '-'));
}
