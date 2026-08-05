// HELIKOPTER TESHISI (beceri #20 helo standoff / #21 pop-up)
// Kullanici: "helikopteri veya balistigi en iyi kullanan AI egitmek".
// SORU: taarruz helosu ATGM menzilinin NERESINDEN ates ediyor, ne kadar yasiyor, onu ne olduruyor?
//   (a) menzilin ucundan vuruyor + uzun yasiyor  -> beceri gereksiz
//   (b) dusmanin uzerine giriyor (yakin ates)    -> STANDOFF gerekli (#20)
//   (c) hic ates edemeden oluyor                 -> SEAD/zamanlama sorunu
//
// DERS (beceri #5'ten): teshis, deltanin CALISACAGI yapilandirmada yapilir. Varsayilan pro ACIK.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const { ctx } = tezgahKur();

const _si = process.argv.indexOf('--seed');
const SEED = _si >= 0 ? Number(process.argv[_si + 1]) : 2024;
const NOPRO = process.argv.includes('--nopro');
const NOHUNT = process.argv.includes('--nohunt');   // IZOLE kontrol kolu: pro acik ama heloHunt KAPALI
const _ti = process.argv.indexOf('--tarif');
const TARIF_AD = _ti >= 0 ? process.argv[_ti + 1] : 'KESIF-helo-2';   // varsayilan: 2 taarruz helosu zorunlu
const tarif = JSON.parse(require('fs').readFileSync('qa-runtime/adaylar.json', 'utf8')).find(t => t.ad === TARIF_AD);
if (!tarif) { console.error('tarif bulunamadi: ' + TARIF_AD); process.exit(1); }

const kod = '(() => {' +
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
    'BATTLE_INTEL4PRO_RED = ' + (!NOPRO) + '; BATTLE_INTEL4PRO_BLUE = ' + (!NOPRO) + ';' +
    'BATTLE_BALANCE.on = true;' +
    'BATTLE_INTEL4PRO_DELTAS.heloHunt = ' + (!NOHUNT) + ';' +
    'BATTLE_RECIPE_RED = ' + JSON.stringify(tarif) + ';' +
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + SEED + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:true }), true, { source:"h", ally:false });' +
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"h", ally:true });' +
    'startBattle();' +
    // hava vurucular: ucan + silahli (taarruz helo, SIHA)
    'const izle = new Map();' +
    'for (const u of SIM.units) { const s = STATS[u.type];' +
    '  if (!s || !u.isAir || !s.weapons || !s.weapons.length) continue;' +
    '  if (s.singleUse) continue;' +                       // kamikaze drone ayri bir vaka
    '  izle.set(u.id, { tip: s.name || s.id, kirmizi: !!u.isRed, menzil: Math.round(u.range), oncekiAmmo: u.ammo,' +
    '    atis: 0, mesafeSum: 0, mesafeN: 0, enYakinAtis: Infinity, canliTik: 0, olduTik: null,' +
    '    aaYakinTik: 0, hpBas: u.hp, rtbTik: 0, hedefliTik: 0, menzildeHedefTik: 0, sonAmmo: u.ammo, maxAmmo: u.maxAmmo, yakitBitTik: 0 }); }' +
    'const ph = SIM.headless; SIM.headless = true; let st = 0;' +
    'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {' +
    '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
    '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
    '  for (const u of SIM.units) { const r = izle.get(u.id); if (!r) continue;' +
    '    if (u.dead) { if (r.olduTik == null) r.olduTik = SIM.tick; continue; }' +
    '    r.canliTik++;' +
    '    if (u.ammo < r.oncekiAmmo - 1e-9 && u.attackTarget) {' +   // ATES ETTI: hedefe olan mesafeyi kaydet
    '      const d = Math.hypot(u.attackTarget.x - u.x, u.attackTarget.y - u.y);' +
    '      r.atis++; r.mesafeSum += d; r.mesafeN++; if (d < r.enYakinAtis) r.enYakinAtis = d; }' +
    '    r.oncekiAmmo = u.ammo; r.sonAmmo = u.ammo;' +
    // ZAMAN BUTCESI: usse donus / hedefi var / menzilde vurulabilir hedef var
    '    if (u._returningToBase) r.rtbTik++;' +
    '    if (u.attackTarget && !u.attackTarget.dead) r.hedefliTik++;' +
    '    if (u.maxFuel > 0 && u.fuel <= u.maxFuel * 0.3) r.yakitBitTik++;' +
    '    { let bulundu = false;' +
    '      for (const e of SIM.units) { if (e.dead || e.loaded || e.isRed === u.isRed) continue;' +
    '        if (typeof unitCanEngage === "function" && !unitCanEngage(STATS[u.type], STATS[e.type])) continue;' +
    '        if (Math.hypot(e.x - u.x, e.y - u.y) <= u.range) { bulundu = true; break; } }' +
    '      if (bulundu) r.menzildeHedefTik++; }' +
    // dusman AA'sinin tehdit zarfinda gecen tik (AA menzili icinde mi?)
    '    for (const e of SIM.units) { if (e.dead || e.isRed === u.isRed) continue;' +
    '      const es = STATS[e.type]; if (!es || !(es.roleTags||[]).includes("anti_air")) continue;' +
    '      if (Math.hypot(e.x - u.x, e.y - u.y) <= e.range) { r.aaYakinTik++; break; } }' +
    '  }' +
    '} } finally { SIM.headless = ph; }' +
    'return JSON.stringify({ helo: [...izle.values()], bitisTik: SIM.tick, huntBind: BATTLE_BALANCE.heloHuntBind||0 });' +
    '})()';

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'helo.js' }));
console.log('HELIKOPTER/SIHA TESHISI — ' + TARIF_AD + ' seed' + SEED + '   [pro:' + (NOPRO ? 'kapali' : 'ACIK') + ']   mac ' + Math.round(r.bitisTik * 0.05) + 'sn');
console.log('');
console.log('  taraf birim'.padEnd(28) + 'menzil'.padStart(7) + '  ATIS'.padStart(6) + '  ortAtisMes'.padStart(12) + '  enYakinAtis'.padStart(13) + '  omur'.padStart(8) + '  AAzarfi%'.padStart(10));
for (const h of r.helo.sort((a, b) => (a.kirmizi === b.kirmizi ? 0 : a.kirmizi ? -1 : 1) || b.atis - a.atis)) {
    const ort = h.mesafeN ? Math.round(h.mesafeSum / h.mesafeN) : null;
    const oran = ort != null ? ' (%' + Math.round(ort / h.menzil * 100) + ' menzil)' : '';
    console.log(((h.kirmizi ? 'KIRMIZI ' : 'mavi    ') + h.tip).padEnd(28) +
        String(h.menzil).padStart(7) +
        String(h.atis).padStart(6) +
        (ort != null ? ort + 'px' : '-').padStart(12) +
        (h.enYakinAtis < Infinity ? Math.round(h.enYakinAtis) + 'px' : '-').padStart(13) +
        (h.olduTik != null ? Math.round(h.olduTik * 0.05) + 'sn' : 'sag').padStart(8) +
        (Math.round(h.aaYakinTik / Math.max(1, h.canliTik) * 100) + '%').padStart(10) + oran);
}
const olen = r.helo.filter(h => h.olduTik != null);
const atmayan = r.helo.filter(h => h.atis === 0);
const tumMes = r.helo.filter(h => h.mesafeN);
const ortOran = tumMes.length ? tumMes.reduce((s, h) => s + (h.mesafeSum / h.mesafeN) / h.menzil, 0) / tumMes.length : null;
console.log('');
console.log('  hava vurucu       : ' + r.helo.length + '   olen: ' + olen.length + '   HIC ATES ETMEYEN: ' + atmayan.length);
console.log('  heloHunt baglama  : ' + r.huntBind + ' tik');
console.log('  ort. atis mesafesi: ' + (ortOran != null ? '%' + Math.round(ortOran * 100) + ' (kendi menzilinin)' : '-'));
console.log('  -> %70 alti = DUSMANIN USTUNE GIRIYOR (standoff gerekli, #20)');
console.log('');
console.log('  ZAMAN BUTCESI (canli tiklerin yuzdesi) + MUHIMMAT:');
console.log('  taraf birim'.padEnd(28) + 'usse-donus'.padStart(11) + '  menzildeHedef'.padStart(15) + '  hedefKilitli'.padStart(14) + '  yakit<%30'.padStart(11) + '  ammo'.padStart(8));
for (const h of r.helo.sort((a, b) => (a.kirmizi === b.kirmizi ? 0 : a.kirmizi ? -1 : 1))) {
    const p = n => ('%' + Math.round(n / Math.max(1, h.canliTik) * 100));
    console.log(((h.kirmizi ? 'KIRMIZI ' : 'mavi    ') + h.tip).padEnd(28) +
        p(h.rtbTik).padStart(11) + p(h.menzildeHedefTik).padStart(15) +
        p(h.hedefliTik).padStart(14) + p(h.yakitBitTik).padStart(11) +
        (h.sonAmmo + '/' + h.maxAmmo).padStart(8));
}
