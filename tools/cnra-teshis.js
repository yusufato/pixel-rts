// CNRA (MLRS) TESHISI (saglik raporu #3: 650 TL, getiri x0.15, %58 hedefli, 2.8 atis, 321sn yasiyor)
// Balistik/SAM'den FARKLI bir suphe: muhimmati yalnizca 3. Uc salvoyu atip 5 dakika bos duruyor olabilir.
// Ayrilan sorular:
//   (a) KURUYOR MU, ne zaman?        -> muhimmat zaman cizgisi
//   (b) kuruduktan sonra IKMAL alıyor mu?
//   (c) muhimmatliyken hedefi var mi -> gorus/menzil sorunu var mi (balistik deseni)
//   (d) her salvo ne kadar HASAR veriyor -> mermi basina deger
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const { ctx } = tezgahKur();
// GERCEKCI ORDU: `zorunlu`-only tarif orduyu DOLDURMUYOR (olculdu: yalnizca 5 birim, butcenin
// cogu harcanmadan kaliyor) -> olcum temsili olmuyor. Gercek paylar tabana eklenir.
const GERCEKCI_TABAN = JSON.parse(require('fs').readFileSync('qa-runtime/gercekci-taban.json','utf8'));

const NOSPOT = process.argv.includes('--nospotter');
const ESCORT = process.argv.includes('--escort');   // elenen supplyEscort'u BU vakada yeniden sina
const _si = process.argv.indexOf('--seeds');
const TOHUMLAR = _si >= 0 ? process.argv[_si + 1].split(',').map(Number) : [2024, 3141, 777, 11, 202, 333];

const kod = [
    '(() => {',
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
    'BATTLE_INTEL4PRO_DELTAS.spotterRequirement = ' + (!NOSPOT) + ';',
    'BATTLE_INTEL4PRO_DELTAS.supplyEscort = ' + ESCORT + ';',
    'const cikti = [];',
    'for (const seed of ' + JSON.stringify(TOHUMLAR) + ') {',
    '  BATTLE_BALANCE.on = true; BATTLE_BALANCE.dmg = {}; BATTLE_BALANCE.kills = {};',
    '  BATTLE_RECIPE_RED = Object.assign({ ad:"CNRA", rol:"attacker", zorunlu:{ mlrs:2 }, tavan:{}, artik:[] }, ' + JSON.stringify(GERCEKCI_TABAN) + ');',
    '  openBattlefieldSession({ mode:"quick", mapId:-2, seed, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    '  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"cn", ally:true });',
    '  startBattle();',
    '  const MT = Object.keys(STATS).map(Number).find(t => STATS[t] && STATS[t].id === "mlrs");',
    '  const izle = new Map();',
    '  for (const u of SIM.units) if (u.type === MT && u.isRed) izle.set(u.id, { onceki:u.ammo, maxAmmo:u.maxAmmo, atis:0, ikmal:0, oldu:null, ilkKuruTik:null });',
    '  const k = { seed, kadro:izle.size, canli:0, kuru:0, muhimmatliVeHedefli:0, muhimmatliVeHedefsiz:0,',
    '    muhimmatliGorunmez:0, atis:0, ikmal:0, olen:0, ilkKuruSn:null, hasar:0, olduren:0, halede:0 };',
    '  const ph = SIM.headless; SIM.headless = true; let st = 0;',
    '  try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
    '    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
    '    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
    '    for (const u of SIM.units) { const r = izle.get(u.id); if (!r) continue;',
    '      if (u.dead) { if (r.oldu === null) { r.oldu = SIM.tick; k.olen++; } continue; }',
    '      k.canli++;',
    '      if (r.onceki != null) {',
    '        if (u.ammo < r.onceki) { r.atis += (r.onceki - u.ammo); k.atis += (r.onceki - u.ammo); }',
    '        else if (u.ammo > r.onceki) { r.ikmal += (u.ammo - r.onceki); k.ikmal += (u.ammo - r.onceki); } }',
    '      r.onceki = u.ammo;',
    '      if (u.ammo <= 0) { k.kuru++; if (r.ilkKuruTik === null) { r.ilkKuruTik = SIM.tick; if (k.ilkKuruSn === null) k.ilkKuruSn = Math.round(SIM.tick*0.05); } continue; }',
    '      if (SIM.tick % 10) continue;',
    '      const s = STATS[u.type]; const minR = s.minRange || 0;',
    '      let banttaVar = false, gorunurVar = false;',
    '      for (const e of SIM.units) { if (e.dead || e.loaded || e.isRed) continue;',
    '        const d = Math.hypot(e.x-u.x, e.y-u.y);',
    '        if (d < minR || d > u.range) continue;',
    '        banttaVar = true;',
    '        if ((d <= u.vision) || canSee(u.isRed, e.x, e.y, e.isAir)) { gorunurVar = true; break; } }',
    '      if (gorunurVar) k.muhimmatliVeHedefli++;',
    '      else if (banttaVar) k.muhimmatliGorunmez++;',
    '      else k.muhimmatliVeHedefsiz++;',
    // ikmal halesi icinde mi
    '      for (const f of SIM.units) { if (f.dead || f.isRed !== u.isRed) continue;',
    '        const a = STATS[f.type] && STATS[f.type].aura; if (!a || a.type !== "resupply") continue;',
    '        if (Math.hypot(f.x-u.x, f.y-u.y) <= (a.radius||3) * ((typeof TILE_PX!=="undefined")?TILE_PX:100)) { k.halede++; break; } }',
    '    }',
    '  } } finally { SIM.headless = ph; }',
    '  k.hasar = Math.round(BATTLE_BALANCE.dmg[MT] || 0); k.olduren = BATTLE_BALANCE.kills[MT] || 0;',
    '  cikti.push(k);',
    '}',
    'return JSON.stringify(cikti);',
    '})()'
].join('');

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'cnra.js' }));
console.log('CNRA (MLRS) TESHISI — ' + r.length + ' tohum   [gozcu kurali: ' + (NOSPOT ? 'kapali' : 'ACIK') + ']');
console.log('');
console.log('  tohum'.padEnd(9) + 'atis'.padStart(6) + ' ikmal'.padStart(7) + '  ilkKuru'.padStart(9) + '  KURU%'.padStart(7) + '  hedefli%'.padStart(10) + ' gorunmez%'.padStart(11) + ' hedefsiz%'.padStart(11) + '  hasar'.padStart(8) + ' olen'.padStart(6));
const T = { atis:0, ikmal:0, kuru:0, canli:0, h:0, g:0, s:0, hasar:0, olen:0, kadro:0, halede:0 };
for (const x of r) {
    const orn = x.muhimmatliVeHedefli + x.muhimmatliGorunmez + x.muhimmatliVeHedefsiz;
    T.atis += x.atis; T.ikmal += x.ikmal; T.kuru += x.kuru; T.canli += x.canli;
    T.h += x.muhimmatliVeHedefli; T.g += x.muhimmatliGorunmez; T.s += x.muhimmatliVeHedefsiz;
    T.hasar += x.hasar; T.olen += x.olen; T.kadro += x.kadro; T.halede += x.halede;
    const p = n => orn ? '%' + Math.round(n / orn * 100) : '-';
    console.log('  ' + String(x.seed).padEnd(9) + String(Math.round(x.atis)).padStart(6) + String(Math.round(x.ikmal)).padStart(7) +
        (x.ilkKuruSn != null ? x.ilkKuruSn + 'sn' : '-').padStart(9) +
        ('%' + Math.round(x.kuru / Math.max(1, x.canli) * 100)).padStart(7) +
        p(x.muhimmatliVeHedefli).padStart(10) + p(x.muhimmatliGorunmez).padStart(11) + p(x.muhimmatliVeHedefsiz).padStart(11) +
        String(x.hasar).padStart(8) + String(x.olen).padStart(6));
}
const orn = T.h + T.g + T.s;
console.log('');
console.log('  TOPLAM kadro ' + T.kadro + '   atis ' + Math.round(T.atis) + '   IKMAL ALDIGI ' + Math.round(T.ikmal) + '   olen ' + T.olen);
console.log('  KURU gecen sure          : %' + Math.round(T.kuru / Math.max(1, T.canli) * 100) + '   <- (a) muhimmat');
console.log('  muhimmatliyken hedefli   : %' + (orn ? Math.round(T.h / orn * 100) : 0));
console.log('  muhimmatliyken GORUNMEZ  : %' + (orn ? Math.round(T.g / orn * 100) : 0) + '   <- (c) gorus (balistik deseni)');
console.log('  muhimmatliyken hedefsiz  : %' + (orn ? Math.round(T.s / orn * 100) : 0) + '   <- (b) menzil/konum');
console.log('  ikmal HALESI icinde      : %' + Math.round(T.halede / Math.max(1, orn) * 100));
console.log('  TOPLAM HASAR ' + T.hasar + '   (maliyet ' + (T.kadro * 650) + ' TL -> hasar/TL ' + (T.kadro ? (T.hasar / (T.kadro * 650)).toFixed(2) : '-') + ')');
