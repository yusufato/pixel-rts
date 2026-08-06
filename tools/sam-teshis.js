// SAM BATARYASI TESHISI (saglik raporu #2: 700 TL, getiri x0.04, %95 bosta, %67 TAM YUKLE oluyor)
// Ayrilan sorular:
//   (a) DUSMANDA UCAK VAR MI?      -> yoksa bosta durmasi NORMAL, sorun KOMPOZISYON/denge
//   (b) ucak var ama MENZIL DISI mi -> konumlandirma
//   (c) ucak menzilde ama ATES ETMIYOR mu -> hedefleme/mekanik
//   (d) NEDEN OLUYOR (117sn)        -> kim olduruyor, nerede duruyor
//   (e) NOKTA-SAVUNMA isi yapiyor mu (balistik/CNRA mermisi kesme) -> gorunmez katki
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const { ctx } = tezgahKur();
// GERCEKCI ORDU: `zorunlu`-only tarif orduyu DOLDURMUYOR (olculdu: yalnizca 5 birim, butcenin
// cogu harcanmadan kaliyor) -> olcum temsili olmuyor. Gercek paylar tabana eklenir.
const GERCEKCI_TABAN = JSON.parse(require('fs').readFileSync('qa-runtime/gercekci-taban.json','utf8'));

const _si = process.argv.indexOf('--seeds');
const TOHUMLAR = _si >= 0 ? process.argv[_si + 1].split(',').map(Number) : [2024, 3141, 777, 11, 202, 333];
// --dusmanhava N : rakibe N hava birimi ZORUNLU kil (hipotez (a) sinamasi)
// --radar N : orduya N adet counter_battery_radar (hava-arama radari) ZORUNLU kil
const NOSPOT = process.argv.includes('--nospotter');   // IZOLE kontrol: pro acik ama spotterRequirement KAPALI
const _ri = process.argv.indexOf('--radar');
const RADAR = _ri >= 0 ? Number(process.argv[_ri + 1]) : 0;
const _di = process.argv.indexOf('--dusmanhava');
const DHAVA = _di >= 0 ? Number(process.argv[_di + 1]) : 0;

const kod = [
    '(() => {',
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
    'BATTLE_INTEL4PRO_DELTAS.spotterRequirement = ' + (!NOSPOT) + ';',
    'const cikti = [];',
    'for (const seed of ' + JSON.stringify(TOHUMLAR) + ') {',
    // KIRMIZI = SAM sahibi (saldiran). MAVI = rakip; hipotez (a) icin hava zorunlu kilinabilir.
    '  BATTLE_RECIPE_RED = Object.assign({ ad:"SAMTEST", rol:"attacker", zorunlu: ' + JSON.stringify(Object.assign({ sam_battery: 2 }, RADAR > 0 ? { counter_battery_radar: RADAR } : {})) + ', tavan:{}, artik:[] }, ' + JSON.stringify(GERCEKCI_TABAN) + ');',
    '  openBattlefieldSession({ mode:"quick", mapId:-2, seed, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    '  const savTarif = ' + (DHAVA > 0 ? 'JSON.stringify({ ad:"RAKIP-HAVA", rol:"defender", zorunlu:{ attack_helo:' + DHAVA + ' }, tavan:{}, artik:[] })' : 'null') + ';',
    '  battleDeployManifest(battleBuildArmyManifest(6500, savTarif ? { maxUnits:48, recipe: JSON.parse(savTarif) } : { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"sam", ally:true });',
    '  startBattle();',
    '  const ST = Object.keys(STATS).map(Number).find(t => STATS[t] && STATS[t].id === "sam_battery");',
    '  const izle = new Map();',
    '  for (const u of SIM.units) if (u.type === ST && u.isRed) izle.set(u.id, { onceki:u.ammo, maxAmmo:u.maxAmmo, atis:0, oldu:null, sonAmmo:u.ammo });',
    '  const k = { seed, canli:0, dusmanHavaVar:0, menzildeHava:0, atis:0, olen:0, kadro:izle.size,',
    '    olduren:{}, ilkOlumSn:null, onleme:0, ortDerinlik:0, derinlikN:0, menzildeGorunur:0, menzildeYakin:0 };',
    '  let sonSeq = -1;',
    '  const ph = SIM.headless; SIM.headless = true; let st = 0;',
    '  try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
    '    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
    '    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
    // KIM OLDURUYOR: forensik lethal olaylarindan SAM hedef olanlari topla
    '    if (typeof BATTLE_FORENSIC !== "undefined" && BATTLE_FORENSIC.buf) {',
    '      for (const ev of BATTLE_FORENSIC.buf) { if (ev.seq <= sonSeq) continue; sonSeq = ev.seq;',
    '        if (!ev.lethal || ev.targetType !== ST) continue;',
    '        const ad = (STATS[ev.attackerType]||{}).id || "?"; k.olduren[ad] = (k.olduren[ad]||0) + 1; } }',
    '    const havaVar = SIM.units.some(e => !e.dead && !e.isRed && e.isAir);',
    '    for (const u of SIM.units) { const r = izle.get(u.id); if (!r) continue;',
    '      if (u.dead) { if (r.oldu === null) { r.oldu = SIM.tick; k.olen++; if (k.ilkOlumSn === null) k.ilkOlumSn = Math.round(SIM.tick*0.05); } continue; }',
    '      k.canli++;',
    '      if (r.onceki != null && u.ammo < r.onceki) { r.atis += (r.onceki - u.ammo); k.atis += (r.onceki - u.ammo); }',
    '      r.onceki = u.ammo; r.sonAmmo = u.ammo;',
    '      if (SIM.tick % 10) continue;',
    '      if (havaVar) k.dusmanHavaVar++;',
    '      k.ortDerinlik += (1 - u.y / WORLD_H); k.derinlikN++;',
    '      { let menzilde = false, gorunur = false, yakin = false;',
    '        for (const e of SIM.units) { if (e.dead || e.isRed || !e.isAir) continue;',
    '          const d = Math.hypot(e.x-u.x, e.y-u.y);',
    '          if (d > u.range || d < (STATS[u.type].minRange||0)) continue;',
    '          menzilde = true;',
    '          if (d <= u.vision) yakin = true;',
    '          if ((d <= u.vision) || canSee(u.isRed, e.x, e.y, true)) { gorunur = true; }',
    '          if (typeof unitCanEngage === "function" && !unitCanEngage(STATS[u.type], STATS[e.type])) { menzilde = menzilde; } }',
    '        if (menzilde) k.menzildeHava++;',
    '        if (gorunur) k.menzildeGorunur++;',
    '        if (yakin) k.menzildeYakin++; }',
    '    }',
    '  } } finally { SIM.headless = ph; }',
    '  let tamYukle = 0;',
    '  for (const [, r] of izle) if (r.oldu != null && r.sonAmmo >= r.maxAmmo) tamYukle++;',
    '  k.tamYukle = tamYukle;',
    '  cikti.push(k);',
    '}',
    'return JSON.stringify(cikti);',
    '})()'
].join('');

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'sam.js' }));
console.log('SAM BATARYASI TESHISI — ' + r.length + ' tohum' + (DHAVA ? '   [rakibe ' + DHAVA + ' helo]' : '   [rakip normal]') + (RADAR ? '   [orduya ' + RADAR + ' HAVA RADARI]' : ''));
console.log('');
console.log('  tohum'.padEnd(9) + 'kadro'.padStart(6) + '  dusmanHava%'.padStart(13) + '  menzildeHava%'.padStart(15) + '  ATIS'.padStart(6) + '  olen'.padStart(6) + ' ilkOlum'.padStart(9) + ' tamYukle'.padStart(9) + '  derinlik'.padStart(10));
let T = { canli: 0, hava: 0, menzil: 0, atis: 0, olen: 0, kadro: 0, tamYukle: 0, derin: 0, derinN: 0 };
const oldurenTop = {};
for (const x of r) {
    const orn = Math.max(1, Math.round(x.canli / 10));
    T.canli += x.canli; T.hava += x.dusmanHavaVar; T.menzil += x.menzildeHava; T.atis += x.atis;
    T.olen += x.olen; T.kadro += x.kadro; T.tamYukle += x.tamYukle; T.derin += x.ortDerinlik; T.derinN += x.derinlikN;
    for (const a in x.olduren) oldurenTop[a] = (oldurenTop[a] || 0) + x.olduren[a];
    console.log('  ' + String(x.seed).padEnd(9) + String(x.kadro).padStart(6) +
        ('%' + Math.round(x.dusmanHavaVar / orn * 100)).padStart(13) +
        ('%' + Math.round(x.menzildeHava / orn * 100)).padStart(15) +
        String(Math.round(x.atis)).padStart(6) + String(x.olen).padStart(6) +
        (x.ilkOlumSn != null ? x.ilkOlumSn + 'sn' : '-').padStart(9) +
        String(x.tamYukle).padStart(9) +
        (x.derinlikN ? (Math.round(x.ortDerinlik / x.derinlikN * 100) / 100).toString() : '-').padStart(10));
}
const ornT = Math.max(1, Math.round(T.canli / 10));
console.log('');
console.log('  TOPLAM  kadro ' + T.kadro + '   olen ' + T.olen + '   tam-yukle olen ' + T.tamYukle + '   toplam atis ' + Math.round(T.atis));
console.log('  dusmanda UCAK VAR olan sure : %' + Math.round(T.hava / ornT * 100) + '   <- (a) kompozisyon');
console.log('  ucak MENZILDE olan sure     : %' + Math.round(T.menzil / ornT * 100) + '   <- (b) konumlandirma');
const TG = r.reduce((a,x)=>a+x.menzildeGorunur,0), TY = r.reduce((a,x)=>a+x.menzildeYakin,0);
console.log('  menzilde ve GORUNUR         : %' + Math.round(TG / ornT * 100) + '   <- (c) gorus');
console.log('  menzilde ve KENDI GORUSUNDE : %' + Math.round(TY / ornT * 100) + '   (gorus 900px, menzil 1650px)');
console.log('  ort. derinlik (0=kendi ussu): ' + (T.derinN ? Math.round(T.derin / T.derinN * 100) / 100 : '-'));
console.log('  SAM"i OLDURENLER: ' + (Object.keys(oldurenTop).length ? Object.entries(oldurenTop).sort((a,b)=>b[1]-a[1]).map(([a,n])=>a+' '+n).join(', ') : '-'));
