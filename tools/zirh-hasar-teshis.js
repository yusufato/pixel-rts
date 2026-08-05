// ZIRHLI HASAR KAYNAGI + OLUM BAGLAMI (kullanici: "AI muhtemelen zirhliyi oyle kotu bir konuma
// sokuyor ki zirhin bir anlami kalmiyor")
// (1) Zirhliya gelen VURUSLARIN kaynak kirilimi: DIRECT_FIRE / TANK_SPLASH / ARTILLERY_SPLASH /
//     SECONDARY_FIRE. Yon carpani (facingDamageMult) YALNIZ dogrudan-ates yolunda okunuyor ->
//     dolayli/patlama payi yuksekse armorFace'in karsilik vermemesi ACIKLANIR.
// (2) Zirhli OLDUGU ANDA baglam: derinlik, 600px'teki dost sayisi, 1200px'teki dusman sayisi.
//     "Yalniz ve ileride mi oluyor" sorusunun cevabi.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const { ctx } = tezgahKur();
const NORATIO = process.argv.includes('--noratio');   // IZOLE kontrol: pro acik ama localRatio KAPALI
const _si = process.argv.indexOf('--seed');
const SEED = _si >= 0 ? Number(process.argv[_si + 1]) : 2024;

const kod = '(() => {' +
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true; BATTLE_BALANCE.on = true;' +
    'BATTLE_INTEL4PRO_DELTAS.localRatio = ' + (!NORATIO) + ';' +
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + SEED + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"zh", ally:true });' +
    'startBattle();' +
    'const zirhli = new Set();' +
    'for (const k in STATS) if (STATS[k] && STATS[k].armorFacing) zirhli.add(Number(k));' +
    'const vurus = {}, olduren = {};' +
    'const olum = [];' +
    'let sonSeq = -1;' +
    'const ph = SIM.headless; SIM.headless = true; let st = 0;' +
    'const izle = new Map();' +
    'for (const u of SIM.units) if (zirhli.has(u.type)) izle.set(u.id, { kirmizi: !!u.isRed, oldu: false });' +
    'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {' +
    '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
    '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
    '  if (typeof BATTLE_FORENSIC !== "undefined" && BATTLE_FORENSIC.buf) {' +
    '    for (const ev of BATTLE_FORENSIC.buf) { if (ev.seq <= sonSeq) continue; sonSeq = ev.seq;' +
    '      if (!zirhli.has(ev.targetType)) continue;' +
    '      const k = ev.kind || "?"; vurus[k] = (vurus[k] || 0) + 1;' +
    '      if (ev.lethal) olduren[k] = (olduren[k] || 0) + 1; } }' +
    '  const gorulen = new Set();' +
    '  for (const u of SIM.units) { if (izle.has(u.id)) { gorulen.add(u.id);' +
    '    if (u.dead && !izle.get(u.id).oldu) { izle.get(u.id).oldu = true;' +
    '      let dost = 0, dusman = 0;' +
    '      for (const o of SIM.units) { if (o.dead || o.loaded || o === u) continue;' +
    '        const d = Math.hypot(o.x - u.x, o.y - u.y);' +
    '        if (o.isRed === u.isRed) { if (d <= 600) dost++; } else if (d <= 1200) dusman++; }' +
    '      olum.push({ sn: Math.round(SIM.tick * BATTLE_TICK_SEC), kirmizi: !!u.isRed,' +
    '        derinlik: Math.round((u.isRed ? u.y / WORLD_H : 1 - u.y / WORLD_H) * 100) / 100, dost, dusman }); } } }' +
    '  for (const [id, r] of izle) if (!gorulen.has(id) && !r.oldu) r.oldu = true;' +
    '} } finally { SIM.headless = ph; }' +
    'return JSON.stringify({ vurus, olduren, olum, kadro: izle.size, bind: BATTLE_BALANCE.localRatioBind || 0 });' +
    '})()';

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'zirhhasar.js' }));
const top = Object.values(r.vurus).reduce((a, b) => a + b, 0);
const topO = Object.values(r.olduren).reduce((a, b) => a + b, 0);
console.log('ZIRHLI HASAR KAYNAGI — seed' + SEED + '   (kadro ' + r.kadro + ' zirhli)   [localRatio: ' + (NORATIO ? 'kapali' : 'ACIK') + ', baglama ' + r.bind + ' tik]');
console.log('  kaynak'.padEnd(24) + 'VURUS'.padStart(8) + '  pay'.padStart(7) + '  OLDUREN'.padStart(9) + '  pay'.padStart(7));
for (const [k, v] of Object.entries(r.vurus).sort((a, b) => b[1] - a[1])) {
    const o = r.olduren[k] || 0;
    console.log('  ' + k.padEnd(22) + String(v).padStart(8) + ('%' + Math.round(v / top * 100)).padStart(7) +
        String(o).padStart(9) + ('%' + (topO ? Math.round(o / topO * 100) : 0)).padStart(7));
}
const dogrudan = (r.vurus.DIRECT_FIRE || 0) + (r.vurus.SECONDARY_FIRE || 0);
console.log('');
console.log('  YON CARPANI OKUNAN pay (DIRECT+SECONDARY): %' + (top ? Math.round(dogrudan / top * 100) : 0) +
    '   -> dusukse armorFace karsilik veremez');
console.log('');
console.log('  OLUM BAGLAMI (zirhli oldugu an):');
console.log('    ' + 'taraf/sn'.padEnd(14) + 'derinlik'.padStart(9) + '  600px dost'.padStart(12) + '  1200px dusman'.padStart(15));
for (const o of r.olum) console.log('    ' + ((o.kirmizi ? 'K ' : 'M ') + o.sn + 'sn').padEnd(14) +
    String(o.derinlik).padStart(9) + String(o.dost).padStart(12) + String(o.dusman).padStart(15));
if (r.olum.length) {
    const od = r.olum.reduce((s, o) => s + o.dost, 0) / r.olum.length;
    const oe = r.olum.reduce((s, o) => s + o.dusman, 0) / r.olum.length;
    console.log('    ORT.'.padEnd(18) + ('') .padStart(5) + String(Math.round(od * 10) / 10).padStart(12) + String(Math.round(oe * 10) / 10).padStart(15));
    console.log('    -> dost<düşman ise zırhlı YALNIZ ölüyor (kötü konuşlandırma kanıtı)');
}
