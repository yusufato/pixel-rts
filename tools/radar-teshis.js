// HAVA-ARAMA RADARI / KARSI-BATARYA TESHISI (counter_battery_radar, 350 TL, silahsiz, hp 200)
//
// TESPIT: birimin aura'si `{ type:"counter_battery", radius:30, effect:"reveals_indirect_shooter",
// duration:8 }` — ama updateAura YALNIZ heal/repair/resupply/command/jamming tiplerini isliyor.
// `counter_battery` HIC ISLENMIYOR: OLU VERI (komuta aracindaki `range: 0.08` ile ayni sinif).
// Birimin bugun calisan tek ozelligi `airRadar: true` (SAM'in ucak gormesi).
//
// ISIM CAKISMASI UYARISI: `counterBattery` pro-deltasi (Unit.js) RADARLA ILGISIZ — o, saldiranin
// kendi dolayli atesinin dusman dolaylisini onceliklemesi. Ama oncelikleyebilmek icin GORMEK
// gerekir; goruntuyu saglayacak radar aurasi ise islemiyor. Zincir kopuk.
//
// UC SORU:
//   (A) IFSA GEREKLI MI: dusman dolaylisi ATES ETTIGI ANDA zaten gorunuyor mu? Goruunuyorsa
//       aurayi uygulamak hicbir sey degistirmez (kompozisyon kurallarindaki dersin aynisi).
//   (B) RADAR YASIYOR MU: 350 TL / hp 200 / "fragile" — ne kadar yasiyor, kim olduruyor?
//   (C) HEDEF VAR MI: kirmizinin dolayli birimi, dusman dolaylisini vurabilecek MENZILDE mi?
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const { ctx } = tezgahKur();

const _si = process.argv.indexOf('--seeds');
const TOHUMLAR = _si >= 0 ? process.argv[_si + 1].split(',').map(Number) : [2024, 3141, 777, 11, 202, 333];
const GERCEKCI_TABAN = JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));

const kod = [
    '(() => {',
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
    'const cikti = [];',
    'for (const seed of ' + JSON.stringify(TOHUMLAR) + ') {',
    '  BATTLE_RECIPE_RED = Object.assign({ ad:"RDR", rol:"attacker", zorunlu:{ counter_battery_radar:1, mlrs:1 }, tavan:{}, artik:[] }, ' + JSON.stringify(GERCEKCI_TABAN) + ');',
    '  openBattlefieldSession({ mode:"quick", mapId:-2, seed, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    '  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"rd", ally:true });',
    '  startBattle();',
    '  const RT = Object.keys(STATS).map(Number).find(t => STATS[t] && STATS[t].id === "counter_battery_radar");',
    '  const k = { seed, radar: 0, radarOmurTik: 0, tik: 0, olduren: {},',
    '    dusmanDolayliTik: 0, gorunurTik: 0,',        // (A) genel gorunurluk
    '    atisOlay: 0, atisGorunur: 0,',               // (A) ATES ANINDA gorunurluk
    '    menzilOlay: 0, kirmiziDolayli: 0, radarKapsam: 0 };',
    '  for (const u of SIM.units) if (u.type === RT && u.isRed) k.radar++;',
    '  for (const u of SIM.units) if (u.isRed && battleIsIndirectType(u.type)) k.kirmiziDolayli++;',
    '  let sonSeq = -1;',
    '  const ph = SIM.headless; SIM.headless = true; let st = 0;',
    '  try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
    '    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
    '    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
    '    k.tik++;',
    '    let radarCanli = null;',
    '    for (const u of SIM.units) { if (!u.dead && u.type === RT && u.isRed) { radarCanli = u; break; } }',
    '    if (radarCanli) k.radarOmurTik++;',
    // (A) genel: dusman dolaylisi gorunur mu (her 10 tikte bir ornek, ucuz)
    '    if (SIM.tick % 10 === 0) {',
    '      for (const e of SIM.units) {',
    '        if (e.dead || e.loaded || e.isRed || !battleIsIndirectType(e.type)) continue;',
    '        k.dusmanDolayliTik++;',
    '        if (canSee(true, e.x, e.y, !!e.isAir)) k.gorunurTik++;',
    // (C) kirmizinin dolaylisi menzilinde mi
    '        for (const m of SIM.units) {',
    '          if (m.dead || !m.isRed || !battleIsIndirectType(m.type)) continue;',
    '          if (Math.hypot(m.x - e.x, m.y - e.y) <= m.range) { k.menzilOlay++; break; }',
    '        }',
    '        if (radarCanli && Math.hypot(radarCanli.x - e.x, radarCanli.y - e.y) <= 30 * TILE_PX) k.radarKapsam++;',
    '      }',
    '    }',
    // (A) ASIL: ATES ETTIGI ANDA gorunur muydu + (B) radari kim olduruyor
    '    if (typeof BATTLE_FORENSIC !== "undefined" && BATTLE_FORENSIC.buf) {',
    '      for (const ev of BATTLE_FORENSIC.buf) {',
    '        if (ev.seq <= sonSeq) continue; sonSeq = ev.seq;',
    '        if (ev.lethal && ev.targetType === RT && ev.targetSide === "red") {',
    '          const ad = (STATS[ev.attackerType]||{}).id || "?"; k.olduren[ad] = (k.olduren[ad]||0)+1; }',
    '        if (ev.attackerSide !== "blue" || !battleIsIndirectType(ev.attackerType)) continue;',
    '        if (ev.attackerX == null) continue;',
    '        k.atisOlay++;',
    '        if (canSee(true, ev.attackerX, ev.attackerY, false)) k.atisGorunur++;',
    '      }',
    '    }',
    '  } } finally { SIM.headless = ph; }',
    '  BATTLE_RECIPE_RED = null;',
    '  cikti.push(k);',
    '}',
    'return JSON.stringify(cikti);',
    '})()'
].join('');

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'rd.js' }));
console.log('HAVA-ARAMA RADARI / KARSI-BATARYA TESHISI — ' + r.length + ' tohum');
console.log('');
console.log('  tohum'.padEnd(9) + 'radar'.padStart(6) + '  omur'.padStart(8) + '  dusmanDolayliGORUNUR'.padStart(22) +
    '  ATES-ANINDA gorunur'.padStart(21) + '  menzilde'.padStart(10));
const T = { radar: 0, omur: 0, tik: 0, dd: 0, gor: 0, ao: 0, ag: 0, mo: 0, rk: 0, kd: 0 };
const O = {};
for (const x of r) {
    T.radar += x.radar; T.omur += x.radarOmurTik; T.tik += x.tik;
    T.dd += x.dusmanDolayliTik; T.gor += x.gorunurTik; T.ao += x.atisOlay; T.ag += x.atisGorunur;
    T.mo += x.menzilOlay; T.rk += x.radarKapsam; T.kd += x.kirmiziDolayli;
    for (const a in x.olduren) O[a] = (O[a] || 0) + x.olduren[a];
    console.log('  ' + String(x.seed).padEnd(9) + String(x.radar).padStart(6) +
        (Math.round(x.radarOmurTik * 0.05) + 'sn').padStart(8) +
        ('%' + (x.dusmanDolayliTik ? Math.round(x.gorunurTik / x.dusmanDolayliTik * 100) : 0)).padStart(22) +
        (x.atisOlay ? '%' + Math.round(x.atisGorunur / x.atisOlay * 100) + ' (' + x.atisOlay + ' atis)' : '- (0 atis)').padStart(21) +
        ('%' + (x.dusmanDolayliTik ? Math.round(x.menzilOlay / x.dusmanDolayliTik * 100) : 0)).padStart(10));
}
console.log('');
console.log('  (A) IFSA GEREKLI MI:');
console.log('      dusman dolaylisi genel olarak zamanin %' + (T.dd ? Math.round(T.gor / T.dd * 100) : 0) + "'inde GORUNUR");
console.log('      ATES ETTIGI ANDA ise %' + (T.ao ? Math.round(T.ag / T.ao * 100) : 0) + "'inde gorunur  (" + T.ao + ' dolayli atis olayi)');
console.log('      radar 3000px kapsaminda gecen sure: %' + (T.dd ? Math.round(T.rk / T.dd * 100) : 0));
console.log('  (B) RADAR       : ort. omur ' + Math.round(T.omur / Math.max(1, r.length) * 0.05) + 'sn / 365sn   olduren: ' +
    (Object.keys(O).length ? Object.entries(O).sort((a, b) => b[1] - a[1]).map(([a, n]) => a + ' ' + n).join(', ') : 'olmedi'));
console.log('  (C) HEDEF       : dusman dolaylisi zamanin %' + (T.mo && T.dd ? Math.round(T.mo / T.dd * 100) : 0) +
    "'inde kirmizi dolayli MENZILINDE  (kirmizi dolayli birim: " + (T.kd / r.length).toFixed(1) + ')');
console.log('');
console.log('  OKUMA: ates-aninda gorunurluk YUKSEKse ifsa aurasi bir sey degistirmez (olu veri kalabilir).');
console.log('         DUSUK + menzilde-olma yuksekse, ifsa karsi-bateryayi acan eksik halkadir.');
