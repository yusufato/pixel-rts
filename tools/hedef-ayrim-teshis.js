// FAZ 0.3 — "ENJEKTE PLANDA GRUP HEDEFLERI AYRIK MI?"
//
// `battleBuildInjectedPlan` (js/BattleOracle.js) TEK bir `inj.point` hedefi kurar; yalniz FLANK
// grubu ayri `flankPoint` alir. MAIN ve FIXING ayni noktayi paylasiyor olabilir. Kod-AI'nin kendi
// planlayicisi ise hedefleri gruplara AYRI secer. Farksa blob'un yapisal sebebi budur.
//
// OLCU: ayni karar aninda iki planin `taskContracts[].destination` noktalari arasi ortalama ve
// EN KUCUK ikili mesafe. Kucuk = gruplar ayni yere gidiyor.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const _si = process.argv.indexOf('--seeds');
const TOHUMLAR = _si >= 0 ? process.argv[_si + 1].split(',').map(Number) : [2024, 3141, 777, 11, 202, 333];
const KARAR_TIK = Math.max(600, Number(arg('--karar', 1800)) || 1800);

const { ctx } = tezgahKur();

const kod = [
    '(() => {',
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
    'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
    'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
    'const cikti = [];',
    'for (const seed of ' + JSON.stringify(TOHUMLAR) + ') {',
    '  BATTLE_RECIPE_RED = null;',
    '  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
    '  openBattlefieldSession({ mode:"quick", mapId:-2, seed, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    '  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
    '  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"ha", ally:true });',
    '  startBattle();',
    '  const ph = SIM.headless; SIM.headless = true; let st = 0;',
    '  try {',
    '    while (SIM.tick < ' + KARAR_TIK + ' && phase === PHASE.BATTLE) {',
    '      st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
    '      if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
    '    }',
    '    if (phase !== PHASE.BATTLE) { cikti.push({ seed, hata: "erken bitti" }); continue; }',
    '    const ctrl = [...BATTLE_CONTROLLERS.values()].find(c => c.side === true);',
    // (a) KOD-AI'nin kendi plani
    '    const olc = (plan) => {',
    '      const pts = (plan && plan.taskContracts || [])',
    '        .filter(c => c.destination && c.groupRole && c.groupRole !== "SUPPORT" && c.groupRole !== "RECON")',
    '        .map(c => ({ rol: c.groupRole, x: c.destination.x, y: c.destination.y }));',
    '      if (pts.length < 2) return null;',
    '      let top = 0, n = 0, enKucuk = Infinity, ayniNokta = 0;',
    '      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {',
    '        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);',
    '        top += d; n++; if (d < enKucuk) enKucuk = d; if (d < 1) ayniNokta++; }',
    '      return { grup: pts.length, ort: Math.round(top / n), enKucuk: Math.round(enKucuk),',
    '        ayniNokta, roller: pts.map(p => p.rol).join(",") };',
    '    };',
    '    const kodOlc = olc(ctrl.operationalPlan);',
    // (b) ENJEKTE plan (seciciyle ayni yol)
    '    const g = battleOracleGrammarContext(ctrl, true);',
    '    const cands = operationGrammarGenerate(g);',
    '    const A = cands.slice().sort((x, y) => y.allocation.flank - x.allocation.flank)[0];',
    '    for (const c of BATTLE_CONTROLLERS.values()) battleOracleInstallInjection(c);',
    '    const inj = battleCandidateToInjection(A, ctrl.id);',
    '    const injPlan = battleBuildInjectedPlan(ctrl.operationalPlanner, ctrl.committedPlan || {}, ctrl.lastObservation, ctrl.lastSituation, inj);',
    '    const injOlc = olc(injPlan);',
    '    for (const c of BATTLE_CONTROLLERS.values()) battleOracleUninstallInjection(c);',
    '    cikti.push({ seed, kod: kodOlc, enj: injOlc });',
    '  } finally { SIM.headless = ph; }',
    '}',
    'return JSON.stringify(cikti);',
    '})()'
].join('');

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'ha.js' }));
console.log('FAZ 0.3 — GRUP HEDEFLERI AYRIK MI?   karar tik ' + KARAR_TIK);
console.log('  "aynıNokta" = birbirine 1px\'den yakin hedef cifti (gruplar ayni yere gidiyor)');
console.log('');
console.log('  ' + 'tohum'.padEnd(8) + 'kol'.padEnd(10) + 'grup'.padStart(6) + 'ort.mesafe'.padStart(12) +
    'en kucuk'.padStart(10) + 'ayniNokta'.padStart(11) + '   roller');
const T = { kod: { ort: 0, kucuk: 0, ayni: 0, n: 0 }, enj: { ort: 0, kucuk: 0, ayni: 0, n: 0 } };
for (const x of r) {
    if (x.hata) { console.log('  ' + String(x.seed).padEnd(8) + x.hata); continue; }
    for (const [ad, o] of [['kod-AI', x.kod], ['ENJEKTE', x.enj]]) {
        if (!o) { console.log('  ' + String(x.seed).padEnd(8) + ad.padEnd(10) + '  (grup<2)'); continue; }
        const k = ad === 'kod-AI' ? 'kod' : 'enj';
        T[k].ort += o.ort; T[k].kucuk += o.enKucuk; T[k].ayni += o.ayniNokta; T[k].n++;
        console.log('  ' + String(x.seed).padEnd(8) + ad.padEnd(10) + String(o.grup).padStart(6) +
            (o.ort + 'px').padStart(12) + (o.enKucuk + 'px').padStart(10) +
            String(o.ayniNokta).padStart(11) + '   ' + o.roller);
    }
}
console.log('');
for (const [ad, k] of [['kod-AI', 'kod'], ['ENJEKTE', 'enj']]) {
    const t = T[k];
    if (!t.n) continue;
    console.log('  ORTALAMA ' + ad.padEnd(9) + ' gruplar arasi ' + Math.round(t.ort / t.n) + 'px   ' +
        'en yakin cift ' + Math.round(t.kucuk / t.n) + 'px   ayni-nokta cifti ' + (t.ayni / t.n).toFixed(1));
}
console.log('');
console.log('  OKUMA: ENJEKTE planin "en yakin cift" degeri kucukse (ozellikle ayniNokta>0),');
console.log('         MAIN/FIXING ayni hedefi paylasiyor demektir -> gruplar birlesir -> blob.');
