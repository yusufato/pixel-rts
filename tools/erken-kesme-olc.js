// ERKEN KESME POTANSIYELI: |marj| bir esigi ilk astigi andan MAC SONUNA kadar gecen sure
// bosa mi harcaniyor? Ve o anda okunan isaret, NIHAI kazanani ne kadar dogru veriyor?
// Determinizmi BOZMAZ: sim aynen kosar, yalnizca NE ZAMAN DURDUGUMUZ degisir.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const { ctx } = tezgahKur();
const fs = require('fs');
const a = JSON.parse(fs.readFileSync('qa-runtime/adaylar-buyuk.json', 'utf8'));
const sal = a.find(x => x.ad === 'REF-R0'), sav = a.find(x => x.heuristik);
const ESIKLER = [500, 1000, 1500, 2000, 3000];
const TOHUMLAR = [2024, 3141, 777, 11, 202, 333, 4242, 5150, 6060, 90210, 13, 17];

const kod = '(() => {' +
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;' +
    'BATTLE_RECIPE_RED = ' + JSON.stringify(sal) + ';' +
    'const ESIK = ' + JSON.stringify(ESIKLER) + ';' +
    'const sonuc = [];' +
    'for (const seed of ' + JSON.stringify(TOHUMLAR) + ') {' +
    '  openBattlefieldSession({ mode:"quick", mapId:-2, seed, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
    '  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"ek", ally:true });' +
    '  startBattle();' +
    '  const ilkAsim = {}; for (const e of ESIK) ilkAsim[e] = null;' +
    '  const ph = SIM.headless; SIM.headless = true; let st = 0;' +
    '  const deger = (kirmizi) => { let v = 0; for (const u of SIM.units) { if (u.dead || u.loaded) continue; if (!!u.isRed !== kirmizi) continue; const s = STATS[u.type]; v += (s && s.cost) || 0; } return v; };' +
    '  try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {' +
    '    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
    '    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
    '    if (SIM.tick % 20) continue;' +
    '    const m = deger(true) - deger(false);' +
    '    for (const e of ESIK) if (ilkAsim[e] === null && Math.abs(m) >= e) ilkAsim[e] = { tik: SIM.tick, isaret: Math.sign(m) };' +
    '  } } finally { SIM.headless = ph; }' +
    '  const nihai = deger(true) - deger(false);' +
    '  sonuc.push({ seed, bitisTik: SIM.tick, nihaiIsaret: Math.sign(nihai), ilkAsim });' +
    '}' +
    'return JSON.stringify(sonuc);' +
    '})()';

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'ek.js' }));
console.log('ERKEN KESME POTANSIYELI — ' + r.length + ' mac');
console.log('  esik    kesilen mac   ort. KAZANC   isaret DOGRU');
for (const e of ESIKLER) {
    const kesilen = r.filter(x => x.ilkAsim[e]);
    if (!kesilen.length) { console.log('  ' + String(e).padStart(5) + '    0 mac'); continue; }
    const kazanc = kesilen.reduce((s, x) => s + (1 - x.ilkAsim[e].tik / x.bitisTik), 0) / kesilen.length;
    const dogru = kesilen.filter(x => x.ilkAsim[e].isaret === x.nihaiIsaret).length;
    // KESILMEYEN maclar tam kosar -> genel kazanc, kesilenlerin payiyla agirliklanir
    const genel = kesilen.reduce((s, x) => s + (1 - x.ilkAsim[e].tik / x.bitisTik), 0) / r.length;
    console.log('  ' + String(e).padStart(5) + '   ' + String(kesilen.length).padStart(3) + '/' + r.length +
        '        %' + Math.round(kazanc * 100) + ' (genel %' + Math.round(genel * 100) + ')' +
        '      ' + dogru + '/' + kesilen.length + ' = %' + Math.round(dogru / kesilen.length * 100));
}
console.log('');
console.log('  NOT: "kazanc" = o esige ulasildiktan SONRA bosa kosan sure orani.');
console.log('       "isaret dogru" = o andaki marj isareti NIHAI isaretle ayni mi.');
