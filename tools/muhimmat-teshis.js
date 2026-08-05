// MUHIMMAT TESHISI (beceri #5 ikmal bagi / #27 ikmal guvenligi)
// Ikmal PASIF bir hale: kuru birim kamyonun yaricapina girmedikce dolmuyor, kimse kimseye gitmiyor.
// Beceri yazmadan ONCE olcum - hangi sorun gercek?
//   (a) birimler hic kurumuyor            -> beceri gereksiz
//   (b) kuruyorlar ama ikmal YAKIN        -> yalnizca "kuruyunca ikmale git" yeter (#5)
//   (c) kuruyorlar ve ikmal UZAK/OLU      -> ikmal konumlandirmasi/guvenligi de gerekir (#27)
//
// IZOLE kurulum: butun kollarda ayni bayraklar; degisen tek sey sinanan anahtar.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const { ctx } = tezgahKur();

const _si = process.argv.indexOf('--seed');
const SEED = _si >= 0 ? Number(process.argv[_si + 1]) : 2024;
const PRO = process.argv.includes('--pro');
const NORESUP = process.argv.includes('--noresupply');   // IZOLE kontrol kolu: pro acik ama resupplyRun KAPALI
const _mi = process.argv.indexOf('--maxmesafe');   // parametre supurmesi: yalniz UCUZ yolculuklara izin ver
const MAXM = _mi >= 0 ? Number(process.argv[_mi + 1]) : null;

const kod = '(() => {' +
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
    'BATTLE_INTEL4PRO_RED = ' + PRO + '; BATTLE_INTEL4PRO_BLUE = ' + PRO + ';' +
    'BATTLE_INTEL4PRO_DELTAS.resupplyRun = ' + (!NORESUP) + ';' +
    'BATTLE_BALANCE.on = true;' +
    (MAXM != null ? 'PRO_RESUPPLY_MAX_MESAFE = ' + MAXM + ';' : '') +
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + SEED + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:true }), true, { source:"m", ally:false });' +
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"m", ally:true });' +
    'startBattle();' +
    // ikmal kaynaklarini bul (resupply-aura tasiyan birimler)
    'const kaynakTip = new Set(); for (const k in STATS) { const a = STATS[k] && STATS[k].aura;' +
    '  if (a && a.type === "resupply") kaynakTip.add(Number(k)); }' +
    'const izle = new Map();' +
    'for (const u of SIM.units) { if (!u.maxAmmo) continue;' +
    '  izle.set(u.id, { tip: STATS[u.type] ? STATS[u.type].name : "?", kirmizi: !!u.isRed, maxAmmo: u.maxAmmo,' +
    '    kuruTik: 0, canliTik: 0, oncekiAmmo: u.ammo, ikmalAldi: 0, atis: 0, kuruMesafeSum: 0, kuruMesafeN: 0, ilkKuruTik: null }); }' +
    'const kaynaklar = [];' +
    'for (const u of SIM.units) if (kaynakTip.has(u.type)) kaynaklar.push({ id: u.id, kirmizi: !!u.isRed,' +
    '  tip: STATS[u.type].name, yaricap: Math.round((STATS[u.type].aura.radius||0) * TILE_PX), olduTik: null });' +
    'const ph = SIM.headless; SIM.headless = true; let st = 0;' +
    'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {' +
    '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
    '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
    '  for (const k of kaynaklar) { if (k.olduTik == null) { const s = SIM.units.find(x => x.id === k.id); if (!s || s.dead) k.olduTik = SIM.tick; } }' +
    '  for (const u of SIM.units) { const r = izle.get(u.id); if (!r || u.dead) continue;' +
    '    r.canliTik++;' +
    '    if (u.ammo > r.oncekiAmmo + 1e-9) r.ikmalAldi += (u.ammo - r.oncekiAmmo);' +
    '    else if (u.ammo < r.oncekiAmmo - 1e-9) r.atis += (r.oncekiAmmo - u.ammo);' +
    '    r.oncekiAmmo = u.ammo;' +
    '    if (u.ammo <= 1e-9) { r.kuruTik++; if (r.ilkKuruTik == null) r.ilkKuruTik = SIM.tick;' +
    '      if (SIM.tick % 20 === 0) {' +                    // her 1sn: en yakin CANLI dost ikmal kaynagina mesafe
    '        let en = Infinity;' +
    '        for (const s of SIM.units) { if (s.dead || s.isRed !== u.isRed || !kaynakTip.has(s.type)) continue;' +
    '          const d = Math.hypot(s.x - u.x, s.y - u.y); if (d < en) en = d; }' +
    '        if (en < Infinity) { r.kuruMesafeSum += en; r.kuruMesafeN++; } } }' +
    '  }' +
    '} } finally { SIM.headless = ph; }' +
    'return JSON.stringify({ birim: [...izle.values()], kaynaklar, bitisTik: SIM.tick, resupplyBind: BATTLE_BALANCE.resupplyBind||0 });' +
    '})()';

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'muhimmat.js' }));
const bitisSn = Math.round(r.bitisTik * 0.05);
console.log('MUHIMMAT TESHISI — seed' + SEED + '   [pro:' + (PRO ? 'acik' : 'kapali') + ']   mac ' + bitisSn + 'sn');
console.log('');
console.log('  IKMAL KAYNAKLARI:');
for (const k of r.kaynaklar) {
    console.log('    ' + (k.kirmizi ? 'KIRMIZI ' : 'mavi    ') + k.tip.padEnd(20) + 'yaricap ' + String(k.yaricap).padStart(5) + 'px   ' +
        (k.olduTik != null ? 'OLDU ' + Math.round(k.olduTik * 0.05) + 'sn' : 'sag kaldi'));
}
if (!r.kaynaklar.length) console.log('    (hic ikmal kaynagi yok)');

const kuruyan = r.birim.filter(b => b.kuruTik > 0);
console.log('');
console.log('  KURUYAN BIRIM: ' + kuruyan.length + ' / ' + r.birim.length + ' (muhimmatli birim)');
console.log('');
console.log('  taraf birim'.padEnd(30) + 'KURU%'.padStart(7) + '  ilkKuru'.padStart(9) + '  ikmalAldi'.padStart(11) + '  kuruykenIkmalMesafe'.padStart(21));
for (const b of kuruyan.sort((a, b) => b.kuruTik / Math.max(1, b.canliTik) - a.kuruTik / Math.max(1, a.canliTik)).slice(0, 14)) {
    const pct = Math.round(b.kuruTik / Math.max(1, b.canliTik) * 1000) / 10;
    console.log(((b.kirmizi ? 'KIRMIZI ' : 'mavi    ') + b.tip).padEnd(30) +
        (pct + '%').padStart(7) +
        (b.ilkKuruTik != null ? Math.round(b.ilkKuruTik * 0.05) + 'sn' : '-').padStart(9) +
        (Math.round(b.ikmalAldi * 10) / 10).toString().padStart(11) +
        (b.kuruMesafeN ? Math.round(b.kuruMesafeSum / b.kuruMesafeN) + 'px' : 'kaynak YOK').padStart(21));
}
const toplamKuru = r.birim.reduce((s, b) => s + b.kuruTik, 0);
const toplamCanli = r.birim.reduce((s, b) => s + b.canliTik, 0);
const ikmalAlan = r.birim.filter(b => b.ikmalAldi > 0.01).length;
console.log('');
console.log('  TOPLAM kuru-tik orani  : ' + (Math.round(toplamKuru / Math.max(1, toplamCanli) * 1000) / 10) + '%');
console.log('  ikmal ALAN birim sayisi: ' + ikmalAlan + ' / ' + r.birim.length);
console.log('  resupplyRun baglama    : ' + r.resupplyBind + ' tik');
// KATMAN 2 (birim ekonomisi): ordu daha cok ates ediyor mu, yoksa geri cekilip is mi yapmiyor?
const atisTop = r.birim.reduce((s, b) => s + b.atis, 0);
const canliTop = r.birim.reduce((s, b) => s + b.canliTik, 0);
console.log('  KATMAN2 toplam ATIS    : ' + Math.round(atisTop) + '   (canli-tik toplami ' + canliTop + ')');
console.log('  KATMAN2 atis/1000tik   : ' + (Math.round(atisTop / Math.max(1, canliTop) * 1000 * 10) / 10));
const uzak = kuruyan.filter(b => b.kuruMesafeN && b.kuruMesafeSum / b.kuruMesafeN > 600);
console.log('  kuruyken ikmal >600px uzakta olan birim: ' + uzak.length + ' / ' + kuruyan.length +
    '   -> ' + (uzak.length > kuruyan.length / 2 ? 'MESAFE sorunu (#5 ikmale git)' : 'mesafe sorun degil'));
