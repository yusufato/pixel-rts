#!/usr/bin/env node
/* KARSI-PLAN TESHISI — "mesafe neden ARTIYOR" sorusuna bakmak icin AN-BE-AN dokum.
   Tek tohum, iki kol; her ornekte: cikarilan kaynak, kirmizi/mavi kutle merkezi,
   secilen ana-caba sektoru, kaynagin sektoru, yayilma/konsantrasyon karari.
   Amac tahmin yurutmeyi kesmek: sektorler x-bandi, harita tek-eksenli olabilir. */
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('node:fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const TOHUM = Number(arg('--tohum', 143000)) || 143000;
const ORNEK = Math.max(20, Number(arg('--ornek', 200)) || 200);

const { ctx } = tezgahKur();
const taban = JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));
const TARIF = Object.assign({}, taban, {
    ad: 'STANDOFF',
    zorunlu: Object.assign({}, taban.zorunlu, { artillery: 2, mortar_team: 3, mlrs: 1 })
});

function kos(karsiPlan) {
    const kod = '(() => {\n' +
'  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;\n' +
'  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;\n' +
'  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;\n' +
'  BATTLE_INTEL4_DELTAS.profile = true;\n' +
'  BATTLE_KARSI_PLAN = ' + (karsiPlan ? 'true' : 'false') + ';\n' +
'  BATTLE_RECIPE_BLUE = ' + JSON.stringify(TARIF) + ';\n' +
'  BATTLE_RECIPE_RED = null;\n' +
'  openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + TOHUM + ', attackerSide:true,\n' +
'    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });\n' +
'  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;\n' +
'  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true,\n' +
'    varied:true, brainIntel4:true, isAttacker:false, recipe: BATTLE_RECIPE_BLUE }), false,\n' +
'    { source:"kpt", ally:true });\n' +
'  startBattle(); SIM.headless = true;\n' +
'  BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false;\n' +
'  let kirmizi = null;\n' +
'  for (const c of BATTLE_CONTROLLERS.values()) if (c && c.side === true) kirmizi = c;\n' +
'  const sat = [];\n' +
'  sat.push({ tip: "dunya", W: WORLD_W, H: WORLD_H });\n' +
'  let st = 0;\n' +
'  while (phase === PHASE.BATTLE && SIM.tick < 7200) {\n' +
'    if (SIM.battle && SIM.battle.winnerSide !== null) break;\n' +
'    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);\n' +
'    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);\n' +
'    if (SIM.tick % ' + ORNEK + ' !== 0) continue;\n' +
'    let kx=0, ky=0, kn=0, mx=0, my=0, mn=0, dx=0, dy=0, dn=0;\n' +
'    for (const u of SIM.units) {\n' +
'      if (u.dead || u.loaded || u.abandoned) continue;\n' +
'      if (u.isRed) { kx+=u.x; ky+=u.y; kn++; }\n' +
'      else { mx+=u.x; my+=u.y; mn++; if (u.isIndirect) { dx+=u.x; dy+=u.y; dn++; } }\n' +
'    }\n' +
'    const t = battleTaktikTespit(kirmizi);\n' +
'    const kay = (t && t.kanit) ? t.kanit.kaynak : null;\n' +
'    const ss = kirmizi.sectorState || {};\n' +
'    sat.push({ tik: SIM.tick,\n' +
'      kirmizi: kn ? { x: Math.round(kx/kn), y: Math.round(ky/kn) } : null,\n' +
'      mavi: mn ? { x: Math.round(mx/mn), y: Math.round(my/mn) } : null,\n' +
'      dolayli: dn ? { x: Math.round(dx/dn), y: Math.round(dy/dn), n: dn } : null,\n' +
'      kaynak: kay ? { x: Math.round(kay.x), y: Math.round(kay.y) } : null,\n' +
'      anaCaba: ss.mainSector || null,\n' +
'      kaynakSektor: kay ? sectorOfX(kay.x) : null,\n' +
'      tespit: !!(t && t.taktik === "STANDOFF_ATIS") });\n' +
'  }\n' +
'  return JSON.stringify(sat);\n' +
'})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'kpt-' + karsiPlan + '.js' }));
}

const kapali = kos(false);
const acik = kos(true);
const dunya = kapali[0];
console.log('');
console.log('KARSI-PLAN TESHISI   tohum ' + TOHUM + '   dunya ' + dunya.W + ' x ' + dunya.H);
console.log('  sektor sinirlari (x): left < ' + Math.round(dunya.W / 3) +
    '  center < ' + Math.round(dunya.W * 2 / 3) + '  right');
console.log('');
const bas = 'tik'.padStart(5) + '  ' + 'KAPALI: kirmizi'.padEnd(17) + 'anaCaba'.padEnd(9) +
    '| ' + 'ACIK: kirmizi'.padEnd(17) + 'anaCaba'.padEnd(9) + '| kaynak(cikarilan)'.padEnd(20) + 'kSekt  gercekDolayli';
console.log(bas);
console.log('-'.repeat(bas.length));
const n = Math.min(kapali.length, acik.length);
const xy = (p) => p ? ('(' + p.x + ',' + p.y + ')').padEnd(15) : '—'.padEnd(15);
for (let i = 1; i < n; i++) {
    const a = kapali[i], b = acik[i];
    console.log(String(a.tik).padStart(5) + '  ' + xy(a.kirmizi) + '  ' + String(a.anaCaba || '—').padEnd(9) +
        '| ' + xy(b.kirmizi) + '  ' + String(b.anaCaba || '—').padEnd(9) +
        '| ' + xy(b.kaynak) + '     ' + String(b.kaynakSektor || '—').padEnd(7) +
        (b.dolayli ? ('(' + b.dolayli.x + ',' + b.dolayli.y + ') n=' + b.dolayli.n) : '—'));
}
console.log('');
console.log('OKUMA: "kaynak" cikarilan (forensik) konum, "gercekDolayli" mavinin gercek');
console.log('dolayli birimlerinin merkezi. Ikisi cok farkliysa sorun TESPITTE degil');
console.log('KONUM KESTIRIMINDE. anaCaba iki kolda ayni kaliyorsa kanca sektoru degistirmiyor.');
