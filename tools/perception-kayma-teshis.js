// FAZ 0.4 — "TAM-BILGI / PERCEPTION KAYMASI NE KADAR?"
//
// Kodun kendi notu (js/BattleOracle.js:82-83): "model full-info ile egitildi -> perception'a
// gecişte hafif train/inference kaymasi olur". Bu arac o kaymayi OLCER.
//
// YONTEM: ayni karar aninda model IKI KEZ skorlanir:
//   (A) EGITIM bagalami — battleOracleGrammarContext (SIM.units, confidence 1, TAM BILGI)
//   (B) CANLI bagam    — observation.contacts (gorulen/hatirlanan, confidence<1)
// Olculen: secim ne siklikla degisiyor, secilen adayin sirasi ne kadar kayiyor, aday sayisi ayni mi.
// Yuksek kayma => beonai'nin kotu oynamasinin sebebi odul degil DAGILIM KAYMASI olabilir.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const _si = process.argv.indexOf('--seeds');
const TOHUMLAR = _si >= 0 ? process.argv[_si + 1].split(',').map(Number) : [2024, 3141, 777, 11, 202, 333];
const SURUM = arg('--surum', 'beonai-karisim');
const ARALIK = Math.max(100, Number(arg('--aralik', 300)) || 300);

const { ctx } = tezgahKur();

const kod = [
    '(() => {',
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
    'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;',
    'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
    'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
    'const model = BATTLE_BEONAI_SURUMLER[' + JSON.stringify(SURUM) + '] && BATTLE_BEONAI_SURUMLER[' + JSON.stringify(SURUM) + '].model;',
    'if (!model) return JSON.stringify({ hata: "model yok: ' + SURUM + '" });',
    'const cikti = [];',
    'for (const seed of ' + JSON.stringify(TOHUMLAR) + ') {',
    '  BATTLE_RECIPE_RED = null;',
    '  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
    '  openBattlefieldSession({ mode:"quick", mapId:-2, seed, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    '  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
    '  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"pk", ally:true });',
    '  startBattle();',
    '  const k = { seed, karar: 0, farkliSecim: 0, adaySayiFark: 0, sira: 0, siraN: 0, algiBos: 0 };',
    '  const ph = SIM.headless; SIM.headless = true; let st = 0;',
    '  try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
    '    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
    '    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
    '    if (SIM.tick % ' + ARALIK + ' || SIM.tick < 500) continue;',
    '    const c = [...BATTLE_CONTROLLERS.values()].find(x => x.side === true);',
    '    if (!c || !c.lastObservation) continue;',
    '    const obs = c.lastObservation;',
    // (A) EGITIM bagalami: tam bilgi
    '    const gA = battleOracleGrammarContext(c, true);',
    '    const candA = operationGrammarGenerate(gA);',
    // (B) CANLI bagam: perception
    '    const own = (obs.ownUnits && obs.ownUnits.length) ? obs.ownUnits : SIM.units.filter(u => !u.dead && u.isRed);',
    '    const alg = ((obs.contacts) || []).filter(x => x && (x.visible || x.confidence > 0));',
    '    if (!alg.length) { k.algiBos++; continue; }',
    '    const contacts = alg.map(x => ({ x: x.x, y: x.y, confidence: x.confidence != null ? x.confidence : 1, estimatedStrength: x.estimatedStrength || 50 }));',
    '    let role = c.lastSituation && c.lastSituation.role;',
    '    if (!role && typeof battleRoleForSide === "function") role = battleRoleForSide(true);',
    '    const gB = opgBuildContext(true, own, contacts, role);',
    '    const candB = operationGrammarGenerate(gB);',
    '    if (!candA.length || !candB.length) continue;',
    '    const maxTicks = Math.round(((BATTLE_SESSION && BATTLE_SESSION.durationSec) || 240) / BATTLE_TICK_SEC);',
    '    const skorla = (g, cands, own2, cnt) => {',
    '      let mn = Infinity;',
    '      for (const a of own2) for (const b of cnt) { const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < mn) mn = d; }',
    '      const sf = battleStateFeatures(g, { minEnemyDist: mn, tick: SIM.tick, maxTicks, ownCount: own2.length, enemyCount: cnt.length });',
    '      const skor = cands.map(cd => { const s = selForward(model, sf.concat(battleCandidateFeatures(cd, g))).out;',
    '        return Number.isFinite(s) ? s : -Infinity; });',
    '      return skor;',
    '    };',
    '    const ownA = SIM.units.filter(u => !u.dead && u.isRed);',
    '    const cntA = SIM.units.filter(u => !u.dead && !u.isRed).map(u => ({ x: u.x, y: u.y }));',
    '    const sA = skorla(gA, candA, ownA, cntA);',
    '    const sB = skorla(gB, candB, own, contacts);',
    '    const iA = sA.indexOf(Math.max.apply(null, sA));',
    '    const iB = sB.indexOf(Math.max.apply(null, sB));',
    '    k.karar++;',
    '    if (candA.length !== candB.length) k.adaySayiFark++;',
    // imza ile karsilastir (aday listeleri farkli olabilir)
    '    const imz = (cd) => cd.intent + "|" + cd.mainSector + "|" + cd.allocation.main + "|" + cd.allocation.flank + "|" + cd.tempo;',
    '    const secA = imz(candA[iA]), secB = imz(candB[iB]);',
    '    if (secA !== secB) k.farkliSecim++;',
    // secilen-B adayinin A siralamasindaki yeri (varsa)
    '    const jA = candA.findIndex(cd => imz(cd) === secB);',
    '    if (jA >= 0) { const sirali = sA.map((v, i) => [v, i]).sort((p, q) => q[0] - p[0]).map(p => p[1]);',
    '      k.sira += sirali.indexOf(jA); k.siraN++; }',
    '  } } finally { SIM.headless = ph; }',
    '  cikti.push(k);',
    '}',
    'return JSON.stringify(cikti);',
    '})()'
].join('');

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'pk.js' }));
if (r.hata) { console.error(r.hata); process.exit(1); }
console.log('FAZ 0.4 — TAM-BILGI / PERCEPTION KAYMASI   model: ' + SURUM);
console.log('  (A) egitim bagalami = tam bilgi   (B) canli bagam = perception');
console.log('');
console.log('  ' + 'tohum'.padEnd(8) + 'karar'.padStart(7) + 'FARKLI SECIM'.padStart(14) +
    'aday sayisi farkli'.padStart(20) + 'B-secimin A-sirasi'.padStart(20) + '  algi bos'.padStart(10));
const T = { karar: 0, fark: 0, adaySay: 0, sira: 0, siraN: 0, bos: 0 };
for (const x of r) {
    T.karar += x.karar; T.fark += x.farkliSecim; T.adaySay += x.adaySayiFark;
    T.sira += x.sira; T.siraN += x.siraN; T.bos += x.algiBos;
    console.log('  ' + String(x.seed).padEnd(8) + String(x.karar).padStart(7) +
        (x.farkliSecim + ' (%' + Math.round(x.farkliSecim / Math.max(1, x.karar) * 100) + ')').padStart(14) +
        String(x.adaySayiFark).padStart(20) +
        (x.siraN ? (x.sira / x.siraN).toFixed(1) : '-').padStart(20) + String(x.algiBos).padStart(10));
}
console.log('');
console.log('  TOPLAM: ' + T.karar + ' karar   FARKLI SECIM %' + Math.round(T.fark / Math.max(1, T.karar) * 100) +
    '   aday-sayisi farkli %' + Math.round(T.adaySay / Math.max(1, T.karar) * 100) +
    '   B-secimin A-sirasi ort. ' + (T.siraN ? (T.sira / T.siraN).toFixed(1) : '-'));
console.log('');
console.log('  OKUMA: "FARKLI SECIM" yuksekse model egitildigi dunyadan BASKA bir dunyada oynuyor');
console.log('         demektir — bu durumda odulu duzeltmek tek basina yetmez (dagilim kaymasi).');
