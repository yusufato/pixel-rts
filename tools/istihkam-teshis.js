// ISTIHKAM TESHISI — "helolar yakitsizliktan dusuyorsa istihkam neden siper kazmiyor?"
// (kullanici sorusu, 2026-08-06)
//
// UC AYRI SORU, UC AYRI OLCUM:
//   (A) KAPSAMA: macin yuzde kacinda YASAYAN en az bir dost `providesAir` alani var? (helipad
//       SUPPLY_FIELD_DURATION_MS=60sn sonra siliniyor -> bosluk olusuyor mu)
//   (B) ENGEL: istihkam her tik NE yapiyor? Kurmuyorsa NEDEN? (kendi-yarisinda-degil / yakin-tehdit /
//       bastirilmis / kaciyor / zaten-alan-var / enkaz-kapiyor / tamir / insa-ediyor)
//   (C) ERISIM: helo yakiti %30'un altina dustugu ANDA kullanilabilir us VAR MIYDI ve KAC PX otede?
//       (us var ama 900px oteyse helo zaten yetisemez -> "kazmiyor" degil "yanlis yere kaziyor")
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const { ctx } = tezgahKur();

const _si = process.argv.indexOf('--seeds');
const TOHUMLAR = _si >= 0 ? process.argv[_si + 1].split(',').map(Number) : [2024, 3141, 777, 11, 202, 333];
const NOUS = process.argv.includes('--nous');
const ILERI = process.argv.includes('--ileri');   // engineerForward ACIK (izole A/B)   // airBaseRequirement KAPALI (istihkam satin alinmaz)
const GERCEKCI_TABAN = JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));

const kod = [
    '(() => {',
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
    'BATTLE_INTEL4PRO_DELTAS.airBaseRequirement = ' + (!NOUS) + ';',
    'BATTLE_INTEL4PRO_DELTAS.engineerForward = ' + ILERI + ';',
    'const _ILERI = ' + ILERI + ';',
    'const cikti = [];',
    'for (const seed of ' + JSON.stringify(TOHUMLAR) + ') {',
    '  BATTLE_RECIPE_RED = Object.assign({ ad:"IST", rol:"attacker", zorunlu:{ transport_helo:2 }, tavan:{}, artik:[] }, ' + JSON.stringify(GERCEKCI_TABAN) + ');',
    '  openBattlefieldSession({ mode:"quick", mapId:-2, seed, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    '  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"ist", ally:true });',
    '  startBattle();',
    '  const ET = Object.keys(STATS).map(Number).find(t => STATS[t] && STATS[t].id === "engineer");',
    '  const NT = Object.keys(STATS).map(Number).find(t => STATS[t] && STATS[t].id === "transport_helo");',
    '  const k = { seed, istihkam: 0, tik: 0, kapsamaTik: 0, usSayiTop: 0, kuruldu: 0, sebep: {},',
    '    dusukYakitAn: 0, usVardi: 0, usMesafeTop: 0, enYakinUsTop: 0, enYakinUsN: 0, istihkamOldu: 0 };',
    '  for (const u of SIM.units) if (u.type === ET && u.isRed) k.istihkam++;',
    '  const gorulenUs = new Set();',
    '  const ph = SIM.headless; SIM.headless = true; let st = 0;',
    '  try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
    '    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
    '    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
    '    k.tik++;',
    // ── (A) KAPSAMA
    '    let usSayi = 0;',
    '    for (const t of SIM.trenches) { if (t.isRed === true && t.providesSupply !== false && t.providesAir) { usSayi++;',
    '      gorulenUs.add(Math.round(t.x) + "|" + Math.round(t.y) + "|" + (t.createdAt||0)); } }',
    '    if (usSayi > 0) k.kapsamaTik++;',
    '    k.usSayiTop += usSayi;',
    // ── (B) ENGEL: istihkam neden kurmuyor
    '    for (const u of SIM.units) {',
    '      if (u.dead || u.type !== ET || !u.isRed) continue;',
    '      let sb;',
    '      if (u.buildTrenchTarget) sb = "INSA-EDIYOR";',
    '      else if (u.isFleeing) sb = "KACIYOR";',
    '      else if ((u.suppression||0) >= 25) sb = "BASTIRILMIS";',
    '      else if (!(u.y < WORLD_H * (_ILERI ? PRO_IST_ILERI_DERINLIK : 0.55))) sb = "KENDI-YARISINDA-DEGIL";',
    '      else {',
    '        let yakin = false;',
    '        for (const o of SIM.spatialGrid.getNearby(u.x, u.y, 360)) { if (!o.dead && !o.abandoned && o.isRed !== u.isRed) { yakin = true; break; } }',
    '        if (yakin) sb = "YAKIN-TEHDIT";',
    '        else { let alan = false;',
    '          for (const t of SIM.trenches) { if (t.isRed === u.isRed && t.providesSupply !== false && Math.hypot(t.x-u.x, t.y-u.y) < 520) { alan = true; break; } }',
    '          sb = alan ? "ZATEN-ALAN-VAR" : "KURMALI(?)"; }',
    '      }',
    '      k.sebep[sb] = (k.sebep[sb]||0) + 1;',
    '    }',
    // ── (C) ERISIM: helo dusuk yakitta us bulabiliyor mu
    '    for (const u of SIM.units) {',
    '      if (u.dead || u.type !== NT || !u.isRed || !u.maxFuel) continue;',
    '      if (u.fuel > u.maxFuel * 0.30) continue;',
    '      k.dusukYakitAn++;',
    '      let en = 1e9;',
    '      for (const t of SIM.trenches) { if (t.isRed !== u.isRed || t.providesSupply === false || !t.providesAir) continue;',
    '        const d = Math.hypot(t.x-u.x, t.y-u.y); if (d < en) en = d; }',
    '      if (en < 1e8) { k.usVardi++; k.usMesafeTop += en; }',
    '    }',
    '  } } finally { SIM.headless = ph; }',
    '  for (const u of SIM.units) if (u.type === ET && u.isRed && u.dead) k.istihkamOldu++;',
    '  k.kuruldu = gorulenUs.size;',
    '  BATTLE_RECIPE_RED = null;',
    '  cikti.push(k);',
    '}',
    'return JSON.stringify(cikti);',
    '})()'
].join('');

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'ist.js' }));
console.log('ISTIHKAM TESHISI — ' + r.length + ' tohum, gercekci ordu (zorunlu 2 nakliye helo)' + (NOUS ? '   [--nous: us-kurali KAPALI]' : '') + (ILERI ? '   [--ileri: ILERI-US ACIK]' : ''));
console.log('');
console.log('  tohum'.padEnd(9) + 'istihkam'.padStart(9) + ' oldu'.padStart(6) + '  KAPSAMA'.padStart(10) +
    ' ort.us'.padStart(9) + ' kurulan'.padStart(9) + '  heloDusukYakit'.padStart(16) + ' usVardi'.padStart(9) + ' ortMesafe'.padStart(11));
const T = { ist: 0, oldu: 0, tik: 0, kaps: 0, us: 0, kur: 0, dy: 0, uv: 0, um: 0 };
const S = {};
for (const x of r) {
    T.ist += x.istihkam; T.oldu += x.istihkamOldu; T.tik += x.tik; T.kaps += x.kapsamaTik;
    T.us += x.usSayiTop; T.kur += x.kuruldu; T.dy += x.dusukYakitAn; T.uv += x.usVardi; T.um += x.usMesafeTop;
    for (const a in x.sebep) S[a] = (S[a] || 0) + x.sebep[a];
    console.log('  ' + String(x.seed).padEnd(9) + String(x.istihkam).padStart(9) + String(x.istihkamOldu).padStart(6) +
        ('%' + Math.round(x.kapsamaTik / Math.max(1, x.tik) * 100)).padStart(10) +
        (x.usSayiTop / Math.max(1, x.tik)).toFixed(2).padStart(9) + String(x.kuruldu).padStart(9) +
        String(x.dusukYakitAn).padStart(16) +
        ('%' + Math.round(x.usVardi / Math.max(1, x.dusukYakitAn) * 100)).padStart(9) +
        (x.usVardi ? Math.round(x.usMesafeTop / x.usVardi) + 'px' : '-').padStart(11));
}
console.log('');
console.log('  (A) KAPSAMA        : macin %' + Math.round(T.kaps / Math.max(1, T.tik) * 100) + "'inde yasayan helipad VAR   (ort. " +
    (T.us / Math.max(1, T.tik)).toFixed(2) + ' adet, toplam ' + T.kur + ' kez kuruldu)');
console.log('  (C) ERISIM         : helo dusuk-yakitta ' + T.dy + ' an; bunlarin %' +
    Math.round(T.uv / Math.max(1, T.dy) * 100) + "'inde us VARDI, ortalama " +
    (T.uv ? Math.round(T.um / T.uv) : '-') + 'px otede');
console.log('  istihkam kadro     : ' + T.ist + '   olen: ' + T.oldu);
console.log('');
console.log('  (B) ISTIHKAM NE YAPIYOR (tik dagilimi):');
const top = Object.values(S).reduce((a, b) => a + b, 0) || 1;
for (const [a, n] of Object.entries(S).sort((x, y) => y[1] - x[1])) {
    console.log('    ' + a.padEnd(24) + String(n).padStart(8) + '  %' + (n / top * 100).toFixed(1));
}
