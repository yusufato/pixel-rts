// ZIRH MEVZII TESHISI (beceri #9 yukselti / #10 yan-zirh koruma)
// Iki mekanik ZATEN VAR: facingDamageMult (MBT yan x1.5, TD arka x3.3) ve _eDelta (yukselti +%28/-%20).
// SORU: AI bunlari kullaniyor mu?
//   (a) zirhli birim dusmana BURNUNU mu doniyor yoksa yanini/arkasini mi veriyor?  -> #10
//   (b) zirhli birim dusmandan YUKSEKTE mi dovusuyor yoksa yokus yukari mi?        -> #9
// Yontem: her 0.5sn, her zirhli birim icin MENZILINDEKI dusman aticilarin ac isini
// on/yan/arka olarak siniflar (maruziyet profili) + yukselti farkini toplar.
// IZOLE: pro HER IKI KOLDA acik (varsayilan); kol farki yalniz sinanan anahtar olur.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const { ctx } = tezgahKur();
const NOFACE = process.argv.includes('--noface');   // IZOLE kontrol kolu: pro acik ama armorFace KAPALI
const _si = process.argv.indexOf('--seed');
const SEED = _si >= 0 ? Number(process.argv[_si + 1]) : 2024;

const kod = '(() => {' +
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
    'BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = true; BATTLE_BALANCE.on = true;' +   // TEK TARAFLI: yalniz savunan (mavi) beceriyi alir
    'BATTLE_INTEL4PRO_DELTAS.armorFace = ' + (!NOFACE) + ';' +
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + SEED + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"z", ally:true });' +
    'startBattle();' +
    'const say = new Map();' +
    // KATMAN 2: MAVI zirhli kadro BASTA kaydedilir; olum/HP dongude izlenir (olu birim SIM.units'ten silinir).
    'const k2 = new Map();' +
    'for (const u of SIM.units) { const s2 = STATS[u.type];' +
    '  if (!s2 || !s2.armorFacing || u.isRed) continue;' +
    '  k2.set(u.id, { maxHp: u.maxHp, hp: u.hp, maliyet: s2.cost || 0, oldu: false, olumTik: null }); }' +   // tip -> {on, yan, arka, yukSum, yukN, tik}
    'const ph = SIM.headless; SIM.headless = true; let st = 0;' +
    'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {' +
    '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
    '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
    '  { const gorulen = new Set();' +
    '    for (const u of SIM.units) { if (k2.has(u.id)) { gorulen.add(u.id); const r2 = k2.get(u.id); if (!u.dead) r2.hp = u.hp; else if (!r2.oldu) { r2.oldu = true; r2.olumTik = SIM.tick; } } }' +
    '    for (const [id, r2] of k2) if (!gorulen.has(id) && !r2.oldu) { r2.oldu = true; r2.olumTik = SIM.tick; } }' +
    '  if (SIM.tick % 10 !== 0) continue;' +
    '  for (const u of SIM.units) {' +
    '    if (u.dead || u.loaded || u.abandoned) continue;' +
    '    const s = STATS[u.type]; if (!s || !s.armorFacing) continue;' +   // yalniz yonlu-zirhli birimler
    '    const ad = (s.name || s.id) + (u.isRed ? " [K]" : " [M]");' +
    '    let r = say.get(ad); if (!r) { r = { on:0, yan:0, arka:0, yukSum:0, yukN:0, tik:0 }; say.set(ad, r); }' +
    '    r.tik++;' +
    '    for (const e of SIM.units) {' +
    '      if (e.dead || e.loaded || e.abandoned || e.isRed === u.isRed) continue;' +
    '      const es = STATS[e.type]; if (!es || !es.weapons || !es.weapons.length) continue;' +
    '      const d = Math.hypot(e.x - u.x, e.y - u.y); if (d > e.range) continue;' +   // yalniz ATES EDEBILEN dusman
    '      let ad2 = Math.abs(Math.atan2(u.y - e.y, u.x - e.x) - u.facingAngle);' +
    '      while (ad2 > Math.PI) ad2 -= Math.PI * 2;' +
    '      ad2 = Math.abs(ad2);' +
    '      if (ad2 < Math.PI / 3) r.arka++; else if (ad2 < 2 * Math.PI / 3) r.yan++; else r.on++;' +
    '      r.yukSum += (u.elevation || 0.5) - (e.elevation || 0.5); r.yukN++;' +
    '    } }' +
    '} } finally { SIM.headless = ph; }' +
    'let mHp = 0, mMax = 0, mCanli = 0, mTop = 0, mKayipTL = 0;' +
    'for (const [, r2] of k2) { mTop++; mMax += r2.maxHp;' +
    '  if (r2.oldu) mKayipTL += r2.maliyet; else { mCanli++; mHp += Math.max(0, r2.hp); } }' +
    'let omurSum = 0, omurN = 0;' +
    'for (const [, r2] of k2) { omurSum += (r2.olumTik != null ? r2.olumTik : SIM.tick); omurN++; }' +
    'return JSON.stringify({ birim: [...say.entries()].map(([ad, r]) => ({ ad, ...r })), bind: BATTLE_BALANCE.armorFaceBind || 0,' +
    '  k2: { zirhliTop: mTop, sagKalan: mCanli, hpOrani: mMax ? mHp / mMax : 0, kayipTL: mKayipTL,' +
    '        ortOmurSn: omurN ? Math.round(omurSum / omurN * BATTLE_TICK_SEC) : 0 } });' +
    '})()';

const _raw = JSON.parse(vm.runInContext(kod, ctx, { filename: 'zirh.js' }));
const r = _raw.birim;
console.log('ZIRH MEVZII TESHISI — seed' + SEED + '   [armorFace: ' + (NOFACE ? 'kapali' : 'ACIK') + ']   baglama ' + _raw.bind + ' tik');
console.log('  birim'.padEnd(28) + 'maruziyet: ON / YAN / ARKA'.padStart(28) + '  yukseltiFarki'.padStart(15) + '  ornek'.padStart(8));
let tOn = 0, tYan = 0, tArka = 0, tYuk = 0, tYukN = 0;
for (const x of r.sort((a, b) => (b.on + b.yan + b.arka) - (a.on + a.yan + a.arka))) {
    const top = x.on + x.yan + x.arka; if (!top) continue;
    tOn += x.on; tYan += x.yan; tArka += x.arka; tYuk += x.yukSum; tYukN += x.yukN;
    const p = n => '%' + Math.round(n / top * 100);
    console.log('  ' + x.ad.padEnd(26) + (p(x.on) + ' / ' + p(x.yan) + ' / ' + p(x.arka)).padStart(28) +
        ((x.yukN ? (x.yukSum / x.yukN >= 0 ? '+' : '') + (Math.round(x.yukSum / x.yukN * 1000) / 1000) : '-') + '').padStart(15) +
        String(top).padStart(8));
}
const T = tOn + tYan + tArka;
console.log('');
console.log('  TOPLAM maruziyet : ÖN %' + Math.round(tOn / T * 100) + '  YAN %' + Math.round(tYan / T * 100) + '  ARKA %' + Math.round(tArka / T * 100));
console.log('  ort. yükselti farkı (+ = biz yüksekteyiz): ' + (tYukN ? (tYuk / tYukN >= 0 ? '+' : '') + Math.round(tYuk / tYukN * 1000) / 1000 : '-'));
console.log('  KATMAN2 (yalniz MAVI pro): zırhlı ' + _raw.k2.sagKalan + '/' + _raw.k2.zirhliTop +
    ' sağ · kalan HP %' + Math.round(_raw.k2.hpOrani * 100) + ' · kaybedilen zırhlı değer ' + _raw.k2.kayipTL + '₺ · ort. ÖMÜR ' + _raw.k2.ortOmurSn + 'sn');
console.log('  -> YAN+ARKA yüksekse #10 (burnu düşmana dön) değerli; yükselti negatifse #9 (tepeyi tut) değerli.');
