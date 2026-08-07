// PLAN ETKI TESHISI — "plan degisince BIRLIKLER gercekten farkli mi davraniyor?"
//
// NEDEN: tavan iki ayri mudahaleyle de yukselmedi.
//   ufuk 12sn -> 40sn : +771 -> +662 (etkisiz)
//   uzay v1 -> v2     : eslestirilmis testte +233, t 0.67 (etkisiz)
// Ikisi birden tek bir hipoteze isaret ediyor: PLAN -> UYGULAMA baglantisi zayif. Yani secici ne
// secerse secsin kod-AI benzer davraniyor olabilir. Bu arac o baglantiyi DOGRUDAN olcer.
//
// YONTEM: ayni karar aninda fork alinir, IKI UC ADAY ayri ayri enjekte edilir ve ayni sure kosulur:
//   A = "TEK-YUMRUK"  (main 0.85, flank 0.05)
//   B = "DERIN KANAT" (main 0.20, flank 0.60)
// Sonra iki kolun BIRIM DAGILIMI karsilastirilir:
//   * sektor-histogram L1 uzakligi (kuvvetin nereye gittigi)
//   * kutle merkezi kaymasi (px)
//   * ayni birimin iki koldaki konum farkinin ortalamasi
// Plan gercekten uygulaniyorsa bu sayilar BUYUK olmali. Kucukse mudahale katmani yanlis demektir.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const _si = process.argv.indexOf('--seeds');
const TOHUMLAR = _si >= 0 ? process.argv[_si + 1].split(',').map(Number) : [2024, 3141, 777, 11, 202, 333];
const KOS_SN = Math.max(5, Number(arg('--kos', 30)) || 30);   // enjeksiyondan sonra kac sn kosulsun
const KARAR_TIK = Math.max(600, Number(arg('--karar', 1800)) || 1800);

const { ctx } = tezgahKur();

const kod = [
    '(() => {',
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
    'BATTLE_GRAMMAR_V2 = true;',
    // SEKTOR-KOMUTA ACIK OLMALI: focusForContract sozlesmenin `sector` alanini YALNIZ bu bayrak
    // acikken okur. Kapaliyken tum gruplar global ortak hedefe duser ve plan farki olculemez.
    'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
    'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
    'const cikti = [];',
    'for (const seed of ' + JSON.stringify(TOHUMLAR) + ') {',
    '  openBattlefieldSession({ mode:"quick", mapId:-2, seed, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    '  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"pe", ally:true });',
    '  startBattle();',
    '  const ph = SIM.headless; SIM.headless = true; let st = 0;',
    '  let kayit = null;',
    '  try {',
    '    while (SIM.tick < ' + KARAR_TIK + ' && phase === PHASE.BATTLE) {',
    '      st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
    '      if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
    '    }',
    '    if (phase !== PHASE.BATTLE) { cikti.push({ seed, hata: "mac erken bitti" }); continue; }',
    '    const ctrl = [...BATTLE_CONTROLLERS.values()].find(c => c.side === true);',
    '    const gctx = battleOracleGrammarContext(ctrl, true);',
    '    const cands = operationGrammarGenerate(gctx);',
    // iki UC aday: ana-eksen agirligi en yuksek olan vs kanat agirligi en yuksek olan
    '    const A = cands.slice().sort((x, y) => y.allocation.main - x.allocation.main)[0];',
    '    const B = cands.slice().sort((x, y) => y.allocation.flank - x.allocation.flank)[0];',
    '    if (!A || !B || A === B) { cikti.push({ seed, hata: "uc aday yok" }); continue; }',
    '    for (const c of BATTLE_CONTROLLERS.values()) battleOracleInstallInjection(c);',
    '    const fork = battleForkCapture();',
    '    const kolKos = (cand) => {',
    '      battleForkRestore(fork);',
    '      BATTLE_ORACLE_INJECTION = battleCandidateToInjection(cand, ctrl.id);',
    '      let t = 0; const N = ' + Math.round(KOS_SN / 0.05) + ';',
    '      const ph2 = SIM.headless; SIM.headless = true;',
    '      try { for (let i = 0; i < N && phase === PHASE.BATTLE; i++) { t += BATTLE_TICK_MS; stepSim(t, BATTLE_TICK_SEC, battleControllersDrive, false); } }',
    '      finally { SIM.headless = ph2; }',
    '      const konum = {}; const sektor = {}; let cx = 0, cy = 0, cn = 0;',
    '      for (const u of SIM.units) { if (u.dead || u.loaded || !u.isRed) continue;',
    '        konum[u.id] = { x: u.x, y: u.y };',
    '        const s = opgSectorOf(u.x, u.y); sektor[s] = (sektor[s] || 0) + ((STATS[u.type]||{}).cost || 0);',
    '        cx += u.x; cy += u.y; cn++; }',
    '      return { konum, sektor, cx: cn ? cx/cn : 0, cy: cn ? cy/cn : 0, n: cn };',
    '    };',
    '    const ra = kolKos(A), rb = kolKos(B);',
    '    battleForkRestore(fork); BATTLE_ORACLE_INJECTION = null;',
    '    for (const c of BATTLE_CONTROLLERS.values()) battleOracleUninstallInjection(c);',
    // sektor histogram L1 (normalize)
    '    const tumS = new Set([...Object.keys(ra.sektor), ...Object.keys(rb.sektor)]);',
    '    let ta = 0, tb = 0; for (const s of tumS) { ta += ra.sektor[s] || 0; tb += rb.sektor[s] || 0; }',
    '    let l1 = 0; for (const s of tumS) l1 += Math.abs((ra.sektor[s]||0)/(ta||1) - (rb.sektor[s]||0)/(tb||1));',
    // ayni birimin konum farki
    '    let bf = 0, bn = 0;',
    '    for (const id in ra.konum) { if (!rb.konum[id]) continue;',
    '      bf += Math.hypot(ra.konum[id].x - rb.konum[id].x, ra.konum[id].y - rb.konum[id].y); bn++; }',
    '    kayit = { seed, planA: A.intent + "/main" + A.allocation.main + "/flank" + A.allocation.flank,',
    '      planB: B.intent + "/main" + B.allocation.main + "/flank" + B.allocation.flank,',
    '      sektorL1: Math.round(l1 * 1000) / 1000,',
    '      merkezKaymasi: Math.round(Math.hypot(ra.cx - rb.cx, ra.cy - rb.cy)),',
    '      ortBirimFarki: bn ? Math.round(bf / bn) : 0, birim: bn };',
    '  } finally { SIM.headless = ph; }',
    '  if (kayit) cikti.push(kayit);',
    '}',
    'BATTLE_GRAMMAR_V2 = false;',
    'return JSON.stringify(cikti);',
    '})()'
].join('');

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'pe.js' }));
console.log('PLAN ETKI TESHISI — ' + r.length + ' tohum, karar tik ' + KARAR_TIK + ', enjeksiyon sonrasi ' + KOS_SN + 'sn');
console.log('  A = ana-eksen agirlikli en uc aday   B = kanat agirlikli en uc aday');
console.log('');
console.log('  ' + 'tohum'.padEnd(8) + 'sektorL1'.padStart(10) + 'merkezKaymasi'.padStart(15) +
    'ortBirimFarki'.padStart(15) + 'birim'.padStart(7) + '   planlar');
let sl = 0, mk = 0, bf = 0, n = 0;
for (const x of r) {
    if (x.hata) { console.log('  ' + String(x.seed).padEnd(8) + '  ' + x.hata); continue; }
    sl += x.sektorL1; mk += x.merkezKaymasi; bf += x.ortBirimFarki; n++;
    console.log('  ' + String(x.seed).padEnd(8) + x.sektorL1.toFixed(3).padStart(10) +
        (x.merkezKaymasi + 'px').padStart(15) + (x.ortBirimFarki + 'px').padStart(15) +
        String(x.birim).padStart(7) + '   ' + x.planA + '  vs  ' + x.planB);
}
if (n) {
    console.log('');
    console.log('  ORTALAMA: sektorL1 ' + (sl/n).toFixed(3) + '   merkez kaymasi ' + Math.round(mk/n) +
        'px   birim basina fark ' + Math.round(bf/n) + 'px');
    console.log('');
    console.log('  OKUMA: sektorL1 0 = kuvvet dagilimi BIREBIR ayni (plan hic uygulanmamis),');
    console.log('         2 = tamamen ayrik. Birim farki harita olceginde (WORLD_W ~ ' +
        Math.round(vm.runInContext('WORLD_W', ctx)) + 'px) degerlendirilmeli.');
}
