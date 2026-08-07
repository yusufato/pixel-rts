// NAKLIYE HELIKOPTERI TESHISI (saglik raporu: 400 TL, 80sn'de OLUYOR, silahsiz)
// IFV'de tasima `isAir` kosuluyla KAPALI cikmisti; nakliye helo HAVA oldugu icin onda ACIK olmali.
// Ama gercekten TASIYOR MU? Ayrilan sorular:
//   (a) hic piyade BINDIRIYOR mu (yukleme olayi)
//   (b) tasidiysa NEREYE indiriyor (hatta mi, gerisine mi, dusman icine mi)
//   (c) 80sn'de neden oluyor, kim olduruyor
//   (d) tasima OLMASA ne kaybederiz (400 TL bos yere mi gidiyor)
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const { ctx } = tezgahKur();

const _si = process.argv.indexOf('--seeds');
const TOHUMLAR = _si >= 0 ? process.argv[_si + 1].split(',').map(Number) : [2024, 3141, 777, 11, 202, 333];
const NOUS = process.argv.includes('--nous');
const NOKRITIK = process.argv.includes('--nokritik');
const ESKIFERRY = process.argv.includes('--eskiferry');   // ferry duzeltmesi KAPALI (eski davranis)   // kritik yakit tabani KAPALI (eski davranis)   // IZOLE kontrol: airBaseRequirement KAPALI
const GERCEKCI_TABAN = JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));

const kod = [
    '(() => {',
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
    'BATTLE_INTEL4PRO_DELTAS.airBaseRequirement = ' + (!NOUS) + ';',
    'BATTLE_HELO_KRITIK_YAKIT = ' + (NOKRITIK ? 0 : 0.12) + ';',
    'BATTLE_FERRY_FIX = ' + (!ESKIFERRY) + ';',
    'const cikti = [];',
    'for (const seed of ' + JSON.stringify(TOHUMLAR) + ') {',
    '  BATTLE_RECIPE_RED = Object.assign({ ad:"NAK", rol:"attacker", zorunlu:{ transport_helo:2 }, tavan:{}, artik:[] }, ' + JSON.stringify(GERCEKCI_TABAN) + ');',
    '  openBattlefieldSession({ mode:"quick", mapId:-2, seed, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    '  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"nk", ally:true });',
    '  startBattle();',
    '  const NT = Object.keys(STATS).map(Number).find(t => STATS[t] && STATS[t].id === "transport_helo");',
    '  const izle = new Map();',
    '  for (const u of SIM.units) if (u.type === NT && u.isRed) izle.set(u.id, {',
    '    slots: u.transportSlots || 0, yuklu: 0, maxYuklu: 0, yuklemeOlayi: 0, indirmeOlayi: 0,',
    '    oldu: null, tasimaTik: 0, canli: 0, indirmeDerinlik: [], rtbTik: 0, sonHp: u.hp, maxHp: u.maxHp, sonYakit: u.fuel, maxYakit: u.maxFuel, olumSebep: null, olurkenYuklu: 0, px: u.x, py: u.y, vx: 0, vy: 0, ters: 0, hareketTik: 0, evre: {}, evreTers: {}, evreYol: {}, evreBuyukTers: {}, evreBuyuk: {}, maxDerin: 0, atFrontTik: 0, ilkRtbYakit: null, ilkRtbUsMesafe: null, dogduYakit: u.fuel });',
    '  const k = { seed, kadro: izle.size, slots: 0, yukleme: 0, indirme: 0, olen: 0, ilkOlumSn: null,',
    '    tasimaTik: 0, canli: 0, olduren: {}, indirmeDerinlik: [], ortDerinlik: 0, derinlikN: 0 };',
    '  let sonSeq = -1;',
    '  const ph = SIM.headless; SIM.headless = true; let st = 0;',
    '  try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
    '    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
    '    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
    '    if (typeof BATTLE_FORENSIC !== "undefined" && BATTLE_FORENSIC.buf) {',
    '      for (const ev of BATTLE_FORENSIC.buf) { if (ev.seq <= sonSeq) continue; sonSeq = ev.seq;',
    '        if (!ev.lethal || ev.targetType !== NT) continue;',
    '        const ad = (STATS[ev.attackerType]||{}).id || "?"; k.olduren[ad] = (k.olduren[ad]||0) + 1; } }',
    '    for (const u of SIM.units) { const r = izle.get(u.id); if (!r) continue;',
    '      if (u.dead) { if (r.oldu === null) { r.oldu = SIM.tick; k.olen++;',
    '        r.olumSebep = (r.sonYakit <= 0.5) ? "YAKIT" : ((r.sonHp <= r.maxHp * 0.25) ? "ATES" : "?");',
    '        if (k.ilkOlumSn === null) k.ilkOlumSn = Math.round(SIM.tick*0.05); } continue; }',
    '      r.canli++; k.canli++;',
    '      { const dx = u.x - r.px, dy = u.y - r.py; r.px = u.x; r.py = u.y;',
    '        const uz = Math.hypot(dx, dy);',
    '        const _yk = Array.isArray(u.cargo) ? u.cargo.length : 0;',
    '        const _hov = !u.isMovingToManualTarget;',
    '        const _ev = _hov ? (_yk ? "HOVER-indir" : "HOVER-bindir") : (_yk ? "UCUS-teslim" : "UCUS-toplama");',
    '        if (uz > 0.5) { r.hareketTik++; r.evre[_ev] = (r.evre[_ev]||0)+1;',
    '          r.evreYol[_ev] = (r.evreYol[_ev]||0) + uz;',
    '          if (uz >= 3) r.evreBuyuk[_ev] = (r.evreBuyuk[_ev]||0)+1;',
    '          if (r.vx || r.vy) { const nokta = (dx*r.vx + dy*r.vy) / (uz * Math.hypot(r.vx, r.vy) || 1);',
    '            if (nokta < -0.3) { r.ters++; r.evreTers[_ev] = (r.evreTers[_ev]||0)+1;',
    '              if (uz >= 3 && Math.hypot(r.vx, r.vy) >= 3) r.evreBuyukTers[_ev] = (r.evreBuyukTers[_ev]||0)+1; } }',
    '          r.vx = dx; r.vy = dy; } }',
    '      if (u._returningToBase) { r.rtbTik++;',
    '        if (r.ilkRtbYakit === null) { r.ilkRtbYakit = Math.round(u.fuel/u.maxFuel*100);',
    '          let en = 1e9; for (const t of (SIM.trenches||[])) { if (!t.providesAir) continue; if (t.isRed !== u.isRed) continue;',
    '            const d = Math.hypot(t.x-u.x, t.y-u.y); if (d < en) en = d; }',
    '          r.ilkRtbUsMesafe = en > 1e8 ? -1 : Math.round(en); } }',
    '      const _der = u.isRed ? (u.y / WORLD_H) : (1 - u.y / WORLD_H);',
    '      if (_der > r.maxDerin) r.maxDerin = Math.round(_der*100)/100;',
    '      if (u.isRed ? (u.y >= WORLD_H*0.60) : (u.y <= WORLD_H*0.40)) r.atFrontTik++;',
    '      const y = Array.isArray(u.cargo) ? u.cargo.length : (u.loadedUnits ? u.loadedUnits.length : 0);',
    '      if (y > r.yuklu) { r.yuklemeOlayi += (y - r.yuklu); k.yukleme += (y - r.yuklu); }',
    '      else if (y < r.yuklu) { r.indirmeOlayi += (r.yuklu - y); k.indirme += (r.yuklu - y);',
    '        k.indirmeDerinlik.push(Math.round((1 - u.y / WORLD_H) * 100) / 100); }',
    '      r.yuklu = y; if (y > r.maxYuklu) r.maxYuklu = y; r.olurkenYuklu = y;',
    '      r.sonHp = u.hp; r.sonYakit = u.fuel;',
    '      if (y > 0) { r.tasimaTik++; k.tasimaTik++; }',
    '      if (SIM.tick % 20 === 0) { k.ortDerinlik += (1 - u.y / WORLD_H); k.derinlikN++; }',
    '    }',
    '  } } finally { SIM.headless = ph; }',
    '  for (const [, r] of izle) { k.slots = r.slots;',
    '    k.sebep = k.sebep || {}; if (r.olumSebep) k.sebep[r.olumSebep] = (k.sebep[r.olumSebep]||0)+1;',
    '    k.icerdeOlen = (k.icerdeOlen||0) + (r.oldu != null ? r.olurkenYuklu : 0);',
    '    k.det = k.det || []; k.det.push({ omurSn: Math.round((r.oldu!=null?r.oldu:SIM.tick)*0.05), sebep: r.olumSebep||"-",',
    '      maxDerin: r.maxDerin, hattaTik: r.atFrontTik, rtbTik: r.rtbTik, rtbYakit: r.ilkRtbYakit,',
    '      usMesafe: r.ilkRtbUsMesafe, dogduYakit: Math.round(r.dogduYakit), yuklu: r.maxYuklu,',
    '      ters: r.ters, hareketTik: r.hareketTik, evre: r.evre, evreTers: r.evreTers, evreYol: r.evreYol, evreBuyuk: r.evreBuyuk, evreBuyukTers: r.evreBuyukTers }); }',
    '  cikti.push(k);',
    '}',
    'return JSON.stringify(cikti);',
    '})()'
].join('');

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'nk.js' }));
console.log('NAKLIYE HELIKOPTERI TESHISI — ' + r.length + ' tohum, gercekci ordu');
console.log('');
console.log('  tohum'.padEnd(9) + 'kadro'.padStart(6) + ' slot'.padStart(6) + '  YUKLEME'.padStart(9) + ' indirme'.padStart(9) +
    '  tasima%'.padStart(9) + '  olen'.padStart(6) + ' ilkOlum'.padStart(9) + '  derinlik'.padStart(10));
const T = { kadro: 0, yuk: 0, ind: 0, tasima: 0, canli: 0, olen: 0, derin: 0, derinN: 0 };
const olduren = {};
for (const x of r) {
    T.kadro += x.kadro; T.yuk += x.yukleme; T.ind += x.indirme; T.tasima += x.tasimaTik;
    T.canli += x.canli; T.olen += x.olen; T.derin += x.ortDerinlik; T.derinN += x.derinlikN;
    for (const a in x.olduren) olduren[a] = (olduren[a] || 0) + x.olduren[a];
    console.log('  ' + String(x.seed).padEnd(9) + String(x.kadro).padStart(6) + String(x.slots).padStart(6) +
        String(x.yukleme).padStart(9) + String(x.indirme).padStart(9) +
        ('%' + Math.round(x.tasimaTik / Math.max(1, x.canli) * 100)).padStart(9) +
        String(x.olen).padStart(6) + (x.ilkOlumSn != null ? x.ilkOlumSn + 'sn' : '-').padStart(9) +
        (x.derinlikN ? (Math.round(x.ortDerinlik / x.derinlikN * 100) / 100).toString() : '-').padStart(10));
}
console.log('');
console.log('  TOPLAM kadro ' + T.kadro + '   YUKLENEN piyade ' + T.yuk + '   INDIRILEN ' + T.ind + '   olen ' + T.olen);
console.log('  yuklu gecen sure : %' + Math.round(T.tasima / Math.max(1, T.canli) * 100) + '   <- (a)+(b) tasima gercekten oluyor mu');
console.log('  ort. derinlik    : ' + (T.derinN ? Math.round(T.derin / T.derinN * 100) / 100 : '-') + '   (0=kendi ussu, 1=dusman ussu)');
const seb={}; let icerde=0;
for (const x of r) { for (const a in (x.sebep||{})) seb[a]=(seb[a]||0)+x.sebep[a]; icerde += (x.icerdeOlen||0); }
console.log('  OLUM SEBEBI      : ' + Object.entries(seb).map(([a,n])=>a+' '+n).join(', ') + '   (YAKIT = yakiti bitip dustu)');
console.log('  ICERDE OLEN piyade: ' + icerde + '   <- helo kargosuyla birlikte olduruyor');
console.log('');
console.log('  HELO BAZINDA (ilk 12):');
console.log('    ' + 'omur'.padStart(6) + 'sebep'.padStart(7) + ' maxDerin'.padStart(10) + ' hattaTik'.padStart(10) + '  rtbTik'.padStart(9) + ' rtbYakit%'.padStart(11) + ' usMesafe'.padStart(10) + '  TERS-DONUS'.padStart(12));
let _n=0; for (const x of r) for (const d of (x.det||[])) { if (_n++>=12) break;
  console.log('    ' + (d.omurSn+'sn').padStart(6) + d.sebep.padStart(7) + String(d.maxDerin).padStart(10) +
    String(d.hattaTik).padStart(10) + String(d.rtbTik).padStart(9) + (d.rtbYakit==null?'-':'%'+d.rtbYakit).padStart(11) +
    (d.usMesafe==null?'-':(d.usMesafe<0?'US-YOK':String(d.usMesafe))).padStart(10) + (d.ters + '/' + d.hareketTik + ' %' + Math.round(d.ters/Math.max(1,d.hareketTik)*100)).padStart(12)); }
console.log('');
let _ters=0,_hrk=0; for (const x of r) for (const d of (x.det||[])) { _ters+=d.ters; _hrk+=d.hareketTik; }
console.log('  TITREME (yon tersine donus / hareketli tik): ' + _ters + '/' + _hrk + '  = %' + (_ters/Math.max(1,_hrk)*100).toFixed(1));
const _E={},_ET={};
for (const x of r) for (const d of (x.det||[])) { for (const a in (d.evre||{})) _E[a]=(_E[a]||0)+d.evre[a];
  for (const a in (d.evreTers||{})) _ET[a]=(_ET[a]||0)+d.evreTers[a]; }
const _Y={},_B={},_BT={};
for (const x of r) for (const d of (x.det||[])) { for (const a in (d.evreYol||{})) _Y[a]=(_Y[a]||0)+d.evreYol[a];
  for (const a in (d.evreBuyuk||{})) _B[a]=(_B[a]||0)+d.evreBuyuk[a];
  for (const a in (d.evreBuyukTers||{})) _BT[a]=(_BT[a]||0)+d.evreBuyukTers[a]; }
console.log('  TITREME EVRE KIRILIMI  (tum-ters/tik | GERCEK-PINPON: >=3px adimda ters | ort.adim px):');
for (const a of Object.keys(_E).sort()) console.log('    ' + a.padEnd(15) +
  ('%' + ((_ET[a]||0)/_E[a]*100).toFixed(0)).padStart(6) + '   PINPON ' +
  (String(_BT[a]||0) + '/' + String(_B[a]||0)).padStart(10) + ' = %' + ((_BT[a]||0)/Math.max(1,_B[a]||0)*100).toFixed(0).padStart(3) +
  '   ort.adim ' + ((_Y[a]||0)/_E[a]).toFixed(2) + 'px');
console.log('  OLDURENLER       : ' + (Object.keys(olduren).length ? Object.entries(olduren).sort((a,b)=>b[1]-a[1]).map(([a,n])=>a+' '+n).join(', ') : '-'));
