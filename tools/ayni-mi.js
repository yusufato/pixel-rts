// "OGRENEN AI, KOD-AI'NIN YAPTIGININ AYNISINI MI YAPIYOR?" (kullanici sorusu)
//
// NEDEN: tavan olcumleri model ile kod-AI arasinda anlamli fark bulamadi (+350, t 0.71). Iki
// ihtimal var ve BUNLAR COK FARKLI SEYLER:
//   (a) model FARKLI oynuyor ama sonuc ayni geliyor  -> uzay dar
//   (b) model AYNI oynuyor                            -> model hic devrede degil / hicbir sey degistirmiyor
// Bu arac ikisini ayirir: ayni tohumda iki kol kosulur ve YORUNGE karsilastirilir.
//
// OLCULENLER:
//   ILK SAPMA TIKI  : birimlerin konumu ilk kez ne zaman ayrisiyor (hic ayrismiyorsa "SAPMA YOK")
//   ORT/MAKS SAPMA  : ayni birimin iki koldaki konum farki (px, harita 5100px)
//   AYNI KARAR ORANI: modelin sectigi plan, kod-AI'nin sectigiyle ayni mi (dogrudan karar kiyasi)
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const _si = process.argv.indexOf('--seeds');
const TOHUMLAR = _si >= 0 ? process.argv[_si + 1].split(',').map(Number) : [2024, 3141, 777, 11];
const SURUM = arg('--surum', 'beonai-karisim');
const ORNEK = Math.max(20, Number(arg('--ornek', 100)) || 100);   // kac tikte bir yorunge ornegi

const { ctx } = tezgahKur();

function kos(surum, seed) {
    const kod = [
        '(() => {',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;',
        'BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'BATTLE_BEONAI_RED = ' + (surum ? JSON.stringify(surum) : 'null') + '; BATTLE_BEONAI_BLUE = null;',
        'BATTLE_RECIPE_RED = null;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"am", ally:true });',
        'startBattle();',
        'const yorunge = [];',
        // MODELIN GERCEKTEN SECTIGI PLAN: enjeksiyon-spec'i her degistiginde kaydet
        'const planlar = [];',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '  if (SIM.tick % ' + ORNEK + ') continue;',
        '  const kare = [];',
        '  for (const u of SIM.units) { if (u.dead || u.loaded || !u.isRed) continue;',
        '    kare.push([u.id, Math.round(u.x), Math.round(u.y)]); }',
        '  kare.sort((a, b) => a[0] - b[0]);',
        '  yorunge.push({ t: SIM.tick, k: kare });',
        '  const ctrl = [...BATTLE_CONTROLLERS.values()].find(c => c.side === true);',
        '  const p = ctrl && ctrl.operationalPlan;',
        '  planlar.push(p ? (p.kind + "|" + (p.objective ? Math.round(p.objective.x) + "," + Math.round(p.objective.y) : "-") +',
        '    "|" + (p.taskContracts || []).map(c => c.groupRole + ":" + (c.unitIds || []).length).join(",")) : "-");',
        '} } finally { SIM.headless = ph; }',
        'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);',
        'BATTLE_BEONAI_RED = null;',
        'return JSON.stringify({ marj: Math.round(oS.effectiveValue - oD.effectiveValue),',
        '  bitisTik: SIM.tick, yorunge, planlar });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'am.js' }));
}

console.log('AYNI MI? — kod-AI vs ' + SURUM + '   (' + TOHUMLAR.length + ' tohum, her ' + ORNEK + ' tikte ornek)');
console.log('');
console.log('  ' + 'tohum'.padEnd(8) + 'ilkSapmaTik'.padStart(13) + 'ortSapma'.padStart(10) +
    'maksSapma'.padStart(11) + '  planFarki'.padStart(12) + '   marj (kod -> model)'.padStart(24));
let sapmasiz = 0, planAyni = 0, planTop = 0;
for (const seed of TOHUMLAR) {
    const a = kos(null, seed), b = kos(SURUM, seed);
    const n = Math.min(a.yorunge.length, b.yorunge.length);
    let ilk = null, topSap = 0, topN = 0, maks = 0;
    for (let i = 0; i < n; i++) {
        const ka = new Map(a.yorunge[i].k.map(z => [z[0], z])), kb = b.yorunge[i].k;
        let kareSap = 0, kareN = 0;
        for (const z of kb) { const w = ka.get(z[0]); if (!w) continue;
            const d = Math.hypot(z[1] - w[1], z[2] - w[2]); kareSap += d; kareN++; if (d > maks) maks = d; }
        if (kareN && kareSap > 0 && ilk === null) ilk = a.yorunge[i].t;
        topSap += kareSap; topN += kareN;
    }
    const pn = Math.min(a.planlar.length, b.planlar.length);
    let ayniPlan = 0;
    for (let i = 0; i < pn; i++) if (a.planlar[i] === b.planlar[i]) ayniPlan++;
    planAyni += ayniPlan; planTop += pn;
    if (ilk === null) sapmasiz++;
    console.log('  ' + String(seed).padEnd(8) + (ilk === null ? 'SAPMA YOK' : String(ilk)).padStart(13) +
        (topN ? Math.round(topSap / topN) + 'px' : '-').padStart(10) + (Math.round(maks) + 'px').padStart(11) +
        ('%' + Math.round((1 - ayniPlan / Math.max(1, pn)) * 100)).padStart(12) +
        (a.marj + ' -> ' + b.marj).padStart(24));
}
console.log('');
console.log('  YORUNGESI HIC AYRISMAYAN mac: ' + sapmasiz + '/' + TOHUMLAR.length);
console.log('  PLAN ayni kalan ornek       : ' + planAyni + '/' + planTop +
    '  (%' + Math.round(planAyni / Math.max(1, planTop) * 100) + ')');
console.log('');
console.log('  OKUMA: "SAPMA YOK" ve plan %100 ayni ise model HIC devrede degildir.');
console.log('         Yorunge ayrisiyor ama marj degismiyorsa uzay dardir (farkli oynuyor, ayni sonuc).');
