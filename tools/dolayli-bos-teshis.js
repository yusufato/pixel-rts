// DOLAYLI ATES NEDEN BOS DURUYOR? (savunan-teshis: muhimmati varken tiklerin %51'inde hedefsiz)
// Bes sebebi AYIRIR - "beceri yaz" demeden once hangisi gercek:
//   (a) MENZILDE DUSMAN YOK          -> konumlandirma sorunu
//   (b) menzilde var ama OLU BOLGEDE -> standoff sorunu (bu birimlerde minRange kucuk)
//   (c) menzilde var ama GORUNMEZ    -> gozcu sorunu
//   (d) gorunur var ama LOS/uygunluk elemis -> hedefleme filtresi
//   (e) hepsi uygun ama yine hedef yok -> mekanik engel (dolum/baski/mühimmat disiplini)
// IZOLE: pro her iki kolda ACIK; kol farki yalniz sinanan anahtar olur.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const { ctx } = tezgahKur();
const NOCREEP = process.argv.includes('--nocreep');   // IZOLE kontrol: pro acik ama indirectCreep KAPALI
const _si = process.argv.indexOf('--seed');
const SEED = _si >= 0 ? Number(process.argv[_si + 1]) : 2024;

const kod = '(() => {' +
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true; BATTLE_BALANCE.on = true;' +
    'BATTLE_INTEL4PRO_DELTAS.indirectCreep = ' + (!NOCREEP) + ';' +
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + SEED + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"db", ally:true });' +
    'startBattle();' +
    'const say = new Map();' +   // tip -> sebep sayaclari
    'const ph = SIM.headless; SIM.headless = true; let st = 0;' +
    'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {' +
    '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
    '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
    '  if (SIM.tick % 10) continue;' +
    '  for (const u of SIM.units) {' +
    '    if (u.isRed || u.dead || u.loaded || !u.isIndirect) continue;' +
    '    const s = STATS[u.type]; if (!s) continue;' +
    '    const ad = s.name || s.id;' +
    '    let r = say.get(ad); if (!r) { r = { ornek:0, hedefli:0, kuru:0, aMenzilYok:0, bOluBolge:0, cGorunmez:0, dFiltre:0, eBilinmez:0, muhTasarruf:0, ayniSutun:0, farkliSutun:0, menzil:Math.round(u.range), mesafeSum:0, mesafeN:0, hattaMesafeSum:0, hattaMesafeN:0 }; say.set(ad, r); }' +
    '    r.ornek++;' +
    // KONUM: en yakin dusmana mesafe + KENDI on hattina (en ileri dost muharip) mesafe
    '    { let enD = Infinity;' +
    '      for (const e of SIM.units) { if (e.dead || e.loaded || !e.isRed) continue;' +
    '        const d = Math.hypot(e.x - u.x, e.y - u.y); if (d < enD) enD = d; }' +
    '      if (enD < Infinity) { r.mesafeSum += enD; r.mesafeN++; }' +
    '      let onY = null;' +
    '      for (const f of SIM.units) { if (f.dead || f.loaded || f.isRed) continue;' +
    '        const fs = STATS[f.type]; if (!fs || !fs.weapons || !fs.weapons.length) continue;' +
    '        if (fs.weapons[0].indirect) continue;' +
    '        if (onY === null || f.y < onY) onY = f.y; }' +
    '      if (onY !== null) { r.hattaMesafeSum += (u.y - onY); r.hattaMesafeN++; } }' +
    '    if (u.ammo <= 0) { r.kuru++; continue; }' +
    '    if (u.attackTarget && !u.attackTarget.dead) { r.hedefli++; continue; }' +
    '    if (u.combatState === "Mühimmat Tasarrufu") { r.muhTasarruf++; continue; }' +
    '    const minR = s.minRange || 0;' +
    '    let bandaVar = 0, gorunurVar = 0, uygunVar = 0, menzildeAma = 0;' +
    '    for (const e of SIM.units) {' +
    '      if (e.dead || e.loaded || e.abandoned || !e.isRed) continue;' +
    '      const d = Math.hypot(e.x - u.x, e.y - u.y);' +
    '      if (d > u.range) continue;' +
    '      menzildeAma++;' +
    '      if (d < minR) continue;' +
    '      bandaVar++;' +
    '      const gorunur = (d <= u.vision) || canSee(u.isRed, e.x, e.y, e.isAir);' +
    '      if (!gorunur) continue;' +
    '      gorunurVar++;' +
    '      if (typeof unitCanEngage === "function" && !unitCanEngage(s, STATS[e.type])) continue;' +
    '      uygunVar++;' +
    '    }' +
    '    if (!menzildeAma) { r.aMenzilYok++;' +
    // KULLANICI SORUSU: "nasil hedefsiz kalabiliyor?" -> dusman AYNI SUTUNDA mi, baska sutunda mi?
    '      const SX = 3; const benimSutun = Math.min(SX-1, Math.floor(u.x / WORLD_W * SX));' +
    '      let sutundaDusman = false;' +
    '      for (const e of SIM.units) { if (e.dead || e.loaded || !e.isRed) continue;' +
    '        if (Math.min(SX-1, Math.floor(e.x / WORLD_W * SX)) === benimSutun) { sutundaDusman = true; break; } }' +
    '      if (sutundaDusman) r.ayniSutun++; else r.farkliSutun++; }' +
    '    else if (!bandaVar) r.bOluBolge++;' +
    '    else if (!gorunurVar) r.cGorunmez++;' +
    '    else if (!uygunVar) r.dFiltre++;' +
    '    else r.eBilinmez++;' +
    '  }' +
    '} } finally { SIM.headless = ph; }' +
    'return JSON.stringify([...say.entries()].map(([ad, r]) => ({ ad, ...r })));' +
    '})()';

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'db.js' }));
console.log('SAVUNAN DOLAYLI — NEDEN ATES ETMIYOR?   seed' + SEED);
console.log('');
const T = { ornek:0, hedefli:0, kuru:0, aMenzilYok:0, bOluBolge:0, cGorunmez:0, dFiltre:0, eBilinmez:0, muhTasarruf:0 };
for (const x of r) for (const k in T) T[k] += x[k];
console.log('  birim'.padEnd(22) + 'ornek'.padStart(7) + ' HEDEFLI'.padStart(9) + '  kuru'.padStart(7) + '  a:menzilYok'.padStart(13) + ' b:oluBolge'.padStart(11) + ' c:gorunmez'.padStart(12) + ' d:filtre'.padStart(10) + ' e:???'.padStart(8));
for (const x of r.sort((a,b)=>b.ornek-a.ornek)) {
    const p = n => x.ornek ? ('%' + Math.round(n / x.ornek * 100)) : '-';
    console.log('  ' + x.ad.padEnd(20) + String(x.ornek).padStart(7) + p(x.hedefli).padStart(9) + p(x.kuru).padStart(7) +
        p(x.aMenzilYok).padStart(13) + p(x.bOluBolge).padStart(11) + p(x.cGorunmez).padStart(12) + p(x.dFiltre).padStart(10) + p(x.eBilinmez).padStart(8));
}
const P = n => T.ornek ? '%' + Math.round(n / T.ornek * 100) : '-';
console.log('');
console.log('  TOPLAM: hedefli ' + P(T.hedefli) + ' | kuru ' + P(T.kuru) + ' | mühimmat-tasarrufu ' + P(T.muhTasarruf));
console.log('  BOS GECEN SURENIN SEBEBI:');
console.log('     (a) menzilde düşman YOK   ' + P(T.aMenzilYok) + '   -> konumlandırma');
console.log('     (b) ölü bölgede           ' + P(T.bOluBolge) + '   -> standoff');
console.log('     (c) görünmez              ' + P(T.cGorunmez) + '   -> GÖZCÜ');
console.log('     (d) uygunluk filtresi     ' + P(T.dFiltre) + '   -> hedefleme');
console.log('     (e) sebep bilinmiyor      ' + P(T.eBilinmez) + '   -> mekanik engel');
console.log('');
const TA = r.reduce((a,x)=>a+x.ayniSutun,0), TF = r.reduce((a,x)=>a+x.farkliSutun,0);
console.log('  "MENZILDE DUSMAN YOK" ANININ DAGILIMI (kullanici sorusu):');
console.log('     dusman AYNI sutunda ama menzil disi : ' + TA + '  %' + (TA+TF?Math.round(TA/(TA+TF)*100):0) + '   -> menzil/mesafe sorunu');
console.log('     dusman BASKA sutunda               : ' + TF + '  %' + (TA+TF?Math.round(TF/(TA+TF)*100):0) + '   -> SEKTOR sorunu (bos sutunda bekliyor)');
console.log('');
console.log('  KONUM (menzil sorununu buyuten sey):');
console.log('  ' + 'birim'.padEnd(20) + 'menzil'.padStart(8) + '  en yakin dusman'.padStart(17) + '  kendi on hattinin GERISINDE'.padStart(29));
for (const x of r) {
    const md = x.mesafeN ? Math.round(x.mesafeSum / x.mesafeN) : null;
    const hd = x.hattaMesafeN ? Math.round(x.hattaMesafeSum / x.hattaMesafeN) : null;
    console.log('  ' + x.ad.padEnd(20) + String(x.menzil).padStart(8) +
        (md != null ? md + 'px' : '-').padStart(17) +
        (hd != null ? hd + 'px' : '-').padStart(29) + (md != null && md > x.menzil ? '   <- MENZIL DISI' : ''));
}
