// SAVUNAN NEDEN KAYBEDIYOR? (savunan sektor-komuta ACIKKEN BILE 39/48 kaybediyor)
// KULLANICI HIPOTEZLERI:
//   H1 "savunma daginik atis yapiyor; dusmanin on/cok tehdit yaratan saldiri aracina oncelik vermeli"
//   H2 "savunmanin dolaylilari ne gune duruyor; panik olmus dusmani bozguna ugratmak cok kolay"
// BENIM UC ADAYIM (ayni kosuda ayirt edilir):
//   A1 KOMPOZISYON  - savunan rolune uygun ordu kurulmuyor mu? (siperlenebilir piyade/AT/istihkam payi)
//   A2 DURUS        - bolgesini tutmuyor, orta hatta eriyor mu? (olum derinligi)
//   A3 HEDEF/ARAZI  - kazanma kosulu savunani ileri mi cekiyor? (hedefe mesafe / ilerleme baskisi)
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const { ctx } = tezgahKur();
const _si = process.argv.indexOf('--seed');
const SEED = _si >= 0 ? Number(process.argv[_si + 1]) : 2024;

const kod = '(() => {' +
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true; BATTLE_BALANCE.on = true;' +
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + SEED + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"sv", ally:true });' +
    'startBattle();' +
    // A1: savunan kompozisyonu (rol-etiketi bazinda TL payi)
    'const komp = {};' +
    'let savTL = 0;' +
    'for (const u of SIM.units) { if (u.isRed) continue; const s = STATS[u.type]; if (!s) continue;' +
    '  const v = s.cost || 0; savTL += v;' +
    '  const c = s.category || "?"; komp[c] = (komp[c] || 0) + v; }' +
    'let n = 0, odakSum = 0, oncelikVar = 0, oncelikTop = 0;' +
    'let dolayliAtis = 0, dolayliBosTik = 0, dolayliCanliTik = 0;' +
    'let panikOrnek = [], olumDerinlik = [];' +
    'const oncekiAmmo = new Map();' +
    'for (const u of SIM.units) if (!u.isRed) oncekiAmmo.set(u.id, u.ammo);' +
    'const izle = new Map();' +
    'for (const u of SIM.units) if (!u.isRed) izle.set(u.id, false);' +
    'const ph = SIM.headless; SIM.headless = true; let st = 0;' +
    'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {' +
    '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
    '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
    // H2a: dolayli kullanim (atis + bosta gecen tik)
    '  for (const u of SIM.units) { if (u.isRed || u.dead || !u.isIndirect) continue;' +
    '    dolayliCanliTik++;' +
    '    const a = oncekiAmmo.get(u.id); if (a != null && u.ammo < a) dolayliAtis += (a - u.ammo);' +
    '    oncekiAmmo.set(u.id, u.ammo);' +
    '    if (u.ammo > 0 && !u.attackTarget) dolayliBosTik++; }' +
    // A2: olum derinligi
    '  const gor = new Set();' +
    '  for (const u of SIM.units) { if (izle.has(u.id)) { gor.add(u.id);' +
    '    if (u.dead && izle.get(u.id) === false) { izle.set(u.id, true);' +
    '      olumDerinlik.push(Math.round((1 - u.y / WORLD_H) * 100) / 100); } } }' +
    '  for (const [id, o] of izle) if (!gor.has(id) && o === false) izle.set(id, true);' +
    '  if (SIM.tick % 100 !== 0) continue;' +
    // H1: atis odagi + tehdit onceligi
    '  { const hedefler = new Map(); let atici = 0;' +
    '    for (const u of SIM.units) { if (u.isRed || u.dead || !u.attackTarget || u.attackTarget.dead) continue;' +
    '      atici++; hedefler.set(u.attackTarget.id, (hedefler.get(u.attackTarget.id) || 0) + 1); }' +
    '    if (atici >= 3) { n++; odakSum += atici / hedefler.size;' +   // >1 = odaklanma
    // EN TEHDITLI dusman = savunan kutlesine en yakin, YUKSEK DEGERLI zirhli/saldiri araci
    '      let tehdit = null, enIyi = -1;' +
    '      let mx = 0, my = 0, mw = 0;' +
    '      for (const f of SIM.units) { if (f.isRed || f.dead) continue; const fs = STATS[f.type]; const v = (fs && fs.cost) || 0; mx += f.x*v; my += f.y*v; mw += v; }' +
    '      if (mw) { mx /= mw; my /= mw;' +
    '        for (const e of SIM.units) { if (!e.isRed || e.dead || e.isAir) continue; const es = STATS[e.type];' +
    '          if (!es || !es.weapons || !es.weapons.length) continue;' +
    '          const d = Math.hypot(e.x - mx, e.y - my);' +
    '          const skor = (es.cost || 0) / Math.max(300, d);' +   // degerli + yakin = tehditli
    '          if (skor > enIyi) { enIyi = skor; tehdit = e; } }' +
    '        if (tehdit) { oncelikTop++; if (hedefler.has(tehdit.id)) oncelikVar++; } } } }' +
    // H2b: dusman panigi
    '  { let pSum = 0, pN = 0, kacan = 0;' +
    '    for (const e of SIM.units) { if (!e.isRed || e.dead) continue; pSum += (e.panic || 0); pN++; if (e.isFleeing) kacan++; }' +
    '    if (pN) panikOrnek.push({ sn: Math.round(SIM.tick*BATTLE_TICK_SEC), panik: Math.round(pSum/pN), kacan }); }' +
    '} } finally { SIM.headless = ph; }' +
    'return JSON.stringify({ komp, savTL, odak: n ? odakSum/n : null, oncelikOran: oncelikTop ? oncelikVar/oncelikTop : null,' +
    '  dolayliAtis, dolayliBosOran: dolayliCanliTik ? dolayliBosTik/dolayliCanliTik : null,' +
    '  olumDerinlik, panikOrnek, bitisSn: Math.round(SIM.tick*BATTLE_TICK_SEC), sebep: (SIM.battle||{}).outcomeReason });' +
    '})()';

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'sv.js' }));
console.log('SAVUNAN TESHISI — seed' + SEED + '   mac ' + r.bitisSn + 'sn (' + r.sebep + ')');
console.log('');
console.log('  A1 KOMPOZISYON (savunan ' + r.savTL + '₺):');
for (const [k, v] of Object.entries(r.komp).sort((a,b)=>b[1]-a[1]))
    console.log('     ' + k.padEnd(16) + String(v).padStart(6) + '₺  %' + Math.round(v / r.savTL * 100));
console.log('');
console.log('  H1 ATIS ODAGI      : ' + (r.odak != null ? (Math.round(r.odak*100)/100) + ' atıcı/hedef' : '-') + '   (1.0 = herkes ayrı hedefe = DAĞINIK)');
console.log('  H1 TEHDIT ONCELIGI : ' + (r.oncelikOran != null ? '%' + Math.round(r.oncelikOran*100) : '-') + '   (en tehditli düşman hedeflenen örneklerin oranı)');
console.log('  H2 DOLAYLI ATIS    : ' + Math.round(r.dolayliAtis) + ' mermi   BOŞTA geçen tik oranı %' +
    (r.dolayliBosOran != null ? Math.round(r.dolayliBosOran*100) : '-') + '   (mühimmatı varken hedefsiz)');
const od = r.olumDerinlik;
if (od.length) {
    const ort = od.reduce((a,b)=>a+b,0)/od.length;
    const ileri = od.filter(x=>x>0.5).length;
    console.log('  A2 OLUM DERINLIGI  : ort ' + (Math.round(ort*100)/100) + '   (0=kendi üssü, 0.5=orta hat)   orta hattı GEÇMİŞ ölüm: ' + ileri + '/' + od.length);
}
console.log('');
console.log('  H2 DUSMAN PANIGI (zaman):');
for (const p of r.panikOrnek.filter((_,i)=>i%6===0).slice(0,8))
    console.log('     ' + String(p.sn).padStart(4) + 'sn   ort panik ' + String(p.panik).padStart(3) + '   kaçan ' + p.kacan);
