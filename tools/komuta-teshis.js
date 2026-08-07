// KOMUTA ARACI TESHISI (600 TL, silahsiz, hale r=12 kare = 1200px)
// Veride tanimli etkiler: accuracy +0.12, range +0.08, orderLatency -0.4, suppressionResist 0.25.
// Kodda KARSILIGI olan: +%12 hasar (commandHaloTick), baski -12/sn, panik -9/-22/sn, rally.
// KARSILIGI OLMAYAN: range +0.08 ve orderLatency -0.4 (hicbir yerde okunmuyor).
//
// DORT SORU:
//   (A) KAPSAMA : hale her tik dost kuvvetin yuzde kacini (DEGER olarak) tutuyor?
//   (B) YETISME : arac yavas (speed 1.5). Dost kutle merkezinden ne kadar geride kaliyor?
//   (C) EKONOMI : halenin KAZANDIRDIGI hasar ne kadar? (hale-ici birimlerin hasari x 0.12/1.12)
//                 600 TL'nin karsiligi var mi -> hasar/TL, diger birimlerle kiyaslanabilir.
//   (D) MORAL   : kac kez rally yapti (kacan dostu geri dondurdu), kac panik/baski giderdi.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const { ctx } = tezgahKur();

const _si = process.argv.indexOf('--seeds');
const TOHUMLAR = _si >= 0 ? process.argv[_si + 1].split(',').map(Number) : [2024, 3141, 777, 11, 202, 333];
const YOK = process.argv.includes('--yok');
const MERKEZ = process.argv.includes('--merkez');   // commandCenter ACIK (izole A/B)   // komuta araci OLMADAN (kontrol kolu)
const GERCEKCI_TABAN = JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));

const kod = [
    '(() => {',
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
    'BATTLE_INTEL4PRO_DELTAS.commandCenter = ' + MERKEZ + ';',
    'const cikti = [];',
    'for (const seed of ' + JSON.stringify(TOHUMLAR) + ') {',
    '  BATTLE_RECIPE_RED = Object.assign({ ad:"KMT", rol:"attacker", zorunlu:' + (YOK ? '{}' : '{ command_vehicle:1 }') + ', tavan:' + (YOK ? '{ command_vehicle:0 }' : '{}') + ', artik:[] }, ' + JSON.stringify(GERCEKCI_TABAN) + ');',
    '  openBattlefieldSession({ mode:"quick", mapId:-2, seed, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    '  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"km", ally:true });',
    '  startBattle();',
    '  const KT = Object.keys(STATS).map(Number).find(t => STATS[t] && STATS[t].id === "command_vehicle");',
    '  const k = { seed, kadro: 0, oldu: 0, omurTik: 0, tik: 0,',
    '    kapsamaDegerTop: 0, kendiDegerTop: 0, kapsamaN: 0, geriKalmaTop: 0, geriKalmaN: 0,',
    '    hasarTop: 0, haleHasar: 0, rally: 0, baskiGiderme: 0, olumSn: null, olduren: {},',
    '    dusmanMesTop: 0, dusmanMesN: 0, geriKapsamaTop: 0, geriKapsamaN: 0,',
    '    ondeTop: 0, ondeN: 0, merkezKapsamaTop: 0, merkezKapsamaN: 0 };',
    '  const kadroIds = new Set();',
    '  for (const u of SIM.units) if (u.type === KT && u.isRed) { k.kadro++; kadroIds.add(u.id); }',
    '  let sonSeq = -1;',
    '  const ph = SIM.headless; SIM.headless = true; let st = 0;',
    '  try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
    '    const kacanOnce = new Set();',
    '    for (const u of SIM.units) if (!u.dead && u.isRed && u.isFleeing) kacanOnce.add(u.id);',
    '    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
    '    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
    '    k.tik++;',
    // (D) rally: bu tik hale-icinde olup kacmayi BIRAKAN dost
    '    for (const u of SIM.units) {',
    '      if (u.dead || !u.isRed) continue;',
    '      const haleIci = (SIM.tick - (u.commandHaloTick || -999)) <= 1;',
    '      if (haleIci && kacanOnce.has(u.id) && !u.isFleeing) k.rally++;',
    '    }',
    // (A) kapsama + (B) yetisme
    '    let kmt = null;',
    '    for (const u of SIM.units) { if (!u.dead && u.type === KT && u.isRed) { kmt = u; break; } }',
    '    if (kmt) {',
    '      k.omurTik++;',
    '      let icDeger = 0, topDeger = 0, cx = 0, cy = 0, cn = 0;',
    '      for (const u of SIM.units) {',
    '        if (u.dead || u.loaded || !u.isRed || u === kmt) continue;',
    '        const v = (STATS[u.type] && STATS[u.type].cost) || 0;',
    '        topDeger += v; cx += u.x * v; cy += u.y * v; cn += v;',
    '        if ((SIM.tick - (u.commandHaloTick || -999)) <= 1) icDeger += v;',
    '      }',
    '      if (topDeger > 0) { k.kapsamaDegerTop += icDeger / topDeger; k.kapsamaN++; }',
    '      if (cn > 0) { k.geriKalmaTop += Math.hypot(kmt.x - cx/cn, kmt.y - cy/cn); k.geriKalmaN++; }',
    '      let enD = 1e9;',
    '      for (const o of SIM.units) { if (o.dead || o.loaded || o.isRed === kmt.isRed) continue;',
    '        const d = Math.hypot(o.x - kmt.x, o.y - kmt.y); if (d < enD) enD = d; }',
    '      if (enD < 1e8) { k.dusmanMesTop += enD; k.dusmanMesN++; }',
    '      if (cn > 0) {',
    '        const gx = cx/cn, gy = cy/cn;',
    '        const uz = Math.hypot(gx - kmt.x, gy - kmt.y) || 1;',
    '        const gerX = kmt.x - (gx - kmt.x)/uz * 500, gerY = kmt.y - (gy - kmt.y)/uz * 500;',
    '        let icD = 0, tpD = 0;',
    '        for (const u of SIM.units) { if (u.dead || u.loaded || !u.isRed || u === kmt) continue;',
    '          const v = (STATS[u.type] && STATS[u.type].cost) || 0; tpD += v;',
    '          if (Math.hypot(u.x - gerX, u.y - gerY) <= 1200) icD += v; }',
    '        if (tpD > 0) { k.geriKapsamaTop += icD/tpD; k.geriKapsamaN++; }',
    '        k.ondeTop += (kmt.isRed ? (kmt.y - gy) : (gy - kmt.y)); k.ondeN++;',
    '        let icM = 0;',
    '        for (const u of SIM.units) { if (u.dead || u.loaded || !u.isRed || u === kmt) continue;',
    '          const v = (STATS[u.type] && STATS[u.type].cost) || 0;',
    '          if (Math.hypot(u.x - gx, u.y - gy) <= 1200) icM += v; }',
    '        if (tpD > 0) { k.merkezKapsamaTop += icM/tpD; k.merkezKapsamaN++; }',
    '      }',
    '    } else if (k.olumSn === null && k.kadro > 0) { k.olumSn = Math.round(SIM.tick * 0.05); k.oldu = 1; }',
    // (C) ekonomi: hale-ici dost birimlerin verdigi hasar
    '    if (typeof BATTLE_FORENSIC !== "undefined" && BATTLE_FORENSIC.buf) {',
    '      for (const ev of BATTLE_FORENSIC.buf) {',
    '        if (ev.seq <= sonSeq) continue; sonSeq = ev.seq;',
    '        if (ev.lethal && ev.targetType === KT && ev.targetSide === "red") { const ad = (STATS[ev.attackerType]||{}).id || "?"; k.olduren[ad] = (k.olduren[ad]||0)+1; }',
    '        if (ev.attackerSide !== "red" || !ev.damage) continue;',
    '        k.hasarTop += ev.damage;',
    '        const a = SIM.units.find(z => z.id === ev.attackerId);',
    '        if (a && (SIM.tick - (a.commandHaloTick || -999)) <= 2) k.haleHasar += ev.damage;',
    '      }',
    '    }',
    '  } } finally { SIM.headless = ph; }',
    '  const oS = battleArmyObservation(true), oD = battleArmyObservation(false);',
    '  k.marj = Math.round(oS.effectiveValue - oD.effectiveValue);',
    '  BATTLE_RECIPE_RED = null;',
    '  cikti.push(k);',
    '}',
    'return JSON.stringify(cikti);',
    '})()'
].join('');

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'km.js' }));
console.log('KOMUTA ARACI TESHISI — ' + r.length + ' tohum' + (YOK ? '   [--yok: KONTROL, komuta araci YOK]' : '   [zorunlu 1 komuta araci]') + (MERKEZ ? '   [--merkez: KOMUTA-MERKEZI ACIK]' : ''));
console.log('');
console.log('  tohum'.padEnd(9) + 'kadro'.padStart(6) + ' omur'.padStart(8) + '  KAPSAMA'.padStart(10) +
    ' geride'.padStart(9) + '  toplamHasar'.padStart(13) + ' haleIci'.padStart(9) + ' rally'.padStart(7) + '  marj'.padStart(8));
const T = { kadro: 0, oldu: 0, omur: 0, tik: 0, kap: 0, kapN: 0, ger: 0, gerN: 0, has: 0, hale: 0, rally: 0, marj: 0 };
for (const x of r) {
    T.kadro += x.kadro; T.oldu += x.oldu; T.omur += x.omurTik; T.tik += x.tik;
    T.kap += x.kapsamaDegerTop; T.kapN += x.kapsamaN; T.ger += x.geriKalmaTop; T.gerN += x.geriKalmaN;
    T.has += x.hasarTop; T.hale += x.haleHasar; T.rally += x.rally; T.marj += x.marj;
    console.log('  ' + String(x.seed).padEnd(9) + String(x.kadro).padStart(6) +
        (Math.round(x.omurTik * 0.05) + 'sn').padStart(8) +
        ('%' + (x.kapsamaN ? Math.round(x.kapsamaDegerTop / x.kapsamaN * 100) : 0)).padStart(10) +
        (x.geriKalmaN ? Math.round(x.geriKalmaTop / x.geriKalmaN) + 'px' : '-').padStart(9) +
        String(Math.round(x.hasarTop)).padStart(13) +
        ('%' + (x.hasarTop ? Math.round(x.haleHasar / x.hasarTop * 100) : 0)).padStart(9) +
        String(x.rally).padStart(7) + String(x.marj).padStart(8));
}
const auraHasar = T.hale * (0.12 / 1.12);   // +%12'lik kismi geri cikar
console.log('');
console.log('  (A) KAPSAMA : hale dost DEGERIN ort. %' + (T.kapN ? Math.round(T.kap / T.kapN * 100) : 0) + "'ini tutuyor");
console.log('  (B) YETISME : kutle merkezinden ort. ' + (T.gerN ? Math.round(T.ger / T.gerN) : '-') + 'px uzakta (hale yaricapi 1200px)');
console.log('  (C) EKONOMI : toplam dost hasar ' + Math.round(T.has) + ', bunun %' +
    (T.has ? Math.round(T.hale / T.has * 100) : 0) + "'i hale icinde verildi");
console.log('                halenin KAZANDIRDIGI hasar ~' + Math.round(auraHasar) +
    '   -> ' + (auraHasar / Math.max(1, 600 * r.length)).toFixed(2) + ' hasar/TL  (600 TL/arac)');
const _O={}; let _dm=0,_dmN=0,_gk=0,_gkN=0;
for (const x of r) { for (const a in x.olduren) _O[a]=(_O[a]||0)+x.olduren[a];
  _dm+=x.dusmanMesTop; _dmN+=x.dusmanMesN; _gk+=x.geriKapsamaTop; _gkN+=x.geriKapsamaN; }
console.log('  (E) TEHDIT  : en yakin dusmana ort. ' + (_dmN?Math.round(_dm/_dmN):'-') + 'px;  olduren: ' +
  (Object.keys(_O).length ? Object.entries(_O).sort((a,b)=>b[1]-a[1]).map(([a,n])=>a+' '+n).join(', ') : 'olmedi'));
console.log('  (F) KARSI-OLGU: 500px GERI cekilse kapsama %' + (_gkN?Math.round(_gk/_gkN*100):0) + '  (simdiki %' + (T.kapN ? Math.round(T.kap/T.kapN*100) : 0) + ')');
let _on=0,_onN=0,_mk=0,_mkN=0;
for (const x of r) { _on+=x.ondeTop; _onN+=x.ondeN; _mk+=x.merkezKapsamaTop; _mkN+=x.merkezKapsamaN; }
console.log('  (G) KONUM   : kutle merkezine gore ort. ' + (_onN?Math.round(_on/_onN):'-') +
  'px  (+ = dusmana dogru ONDE, - = ARKADA)');
console.log('  (H) KARSI-OLGU: tam MERKEZDE otursa kapsama %' + (_mkN?Math.round(_mk/_mkN*100):0) + '  (simdiki %' + (T.kapN ? Math.round(T.kap/T.kapN*100) : 0) + ')');
console.log('  (D) MORAL   : ' + T.rally + ' kez kacan dost hale icinde toparlandi');
console.log('  omur/olum   : ort. ' + Math.round(T.omur / Math.max(1, r.length) * 0.05) + 'sn, olen ' + T.oldu + '/' + T.kadro);
console.log('  ort. marj   : ' + Math.round(T.marj / r.length));
