// KARAR DONGUSU TESHISI — pro neden temas aninda yerel SAYICA azinlikta?
//
// AYIRAN DEGISKEN (olculdu): olum aninda 400px yerel dost/dusman orani pro 1.39 / intel4 2.18.
// Eslesme degil CIPLAK SAYI ayiriyor. Iki aday kaynak var ve bu arac ikisini AYIRIR:
//   (A) EMIR CALKANTISI : birimin hedefi surekli degisiyor -> yolda omur tuketiyor, hicbir yere
//       tam varamıyor. Olcut: hedef-degisim/dk + (katedilen yol / net yer degistirme) israf orani.
//   (B) VARIS SENKRONU  : hedef stabil ama kuvvet PARCA PARCA variyor. Olcut: ilk temas aninda
//       muharip kuvvetin yuzde kaci temas noktasinin 600px'inde + varis zamanlarinin yayilimi.
//
// Ikisi ayni sey degildir ve caresi de ayridir: (A) plan kilidi/histerezis, (B) senkron-bekleme.
// TUZAK NOTU: her iki olcut de BEYIN bazinda toplanir (taraf degil) ve rol ayrilir.
//
// Kullanim: node tools/karar-dongusu.js [--tohum 6] [--atla 0]
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 6)) || 6);
const ATLA = Math.max(0, Number(arg('--atla', 0)) || 0);
const HAVUZ = []; for (let i = 0; i < 96; i++) HAVUZ.push(100000 + i * 137);
const TOHUMLAR = HAVUZ.slice(ATLA, ATLA + N);

const { ctx } = tezgahKur();

function kos(seed, kirmiziSaldiran, proKirmizi) {
    const kod = [
        '(() => {',
        'BATTLE_RECIPE_RED = null;',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;',
        'BATTLE_INTEL4PRO_RED = ' + (proKirmizi ? 'true' : 'false') + ';',
        'BATTLE_INTEL4PRO_BLUE = ' + (proKirmizi ? 'false' : 'true') + ';',
        // PLATFORM: bugun olculen 6 zararli delta KAPALI (en iyi bilinen pro hali uzerinden calis)
        'BATTLE_INTEL4PRO_DELTAS_' + (proKirmizi ? 'RED' : 'BLUE') + ' = { indirectMassing:false, assaultCohesion:false, counterBattery:false, standoff:false, heloHunt:false, spotterRequirement:false };',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ', pro:' + (!proKirmizi) + ' }), false, { source:"kd", ally:true });',
        'startBattle();',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        // (A) EMIR CALKANTISI: birim basina hedef-degisimi + yol israfi
        'const iz = new Map();',   // id -> { degisim, sonHx, sonHy, yol, px, py, bx, by, tik }
        // (B) VARIS SENKRONU: ilk temas anini ve o andaki kuvvet toplanmasini yakala
        'const senkron = { true: null, false: null };',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '  for (const u of SIM.units) {',
        '    if (u.dead || u.loaded || u.abandoned) continue;',
        '    let z = iz.get(u.id);',
        '    if (!z) { z = { degisim: 0, sonHx: u.targetX, sonHy: u.targetY, yol: 0, px: u.x, py: u.y, bx: u.x, by: u.y, tik: 0, kirmizi: u.isRed }; iz.set(u.id, z); }',
        '    z.yol += Math.hypot(u.x - z.px, u.y - z.py); z.px = u.x; z.py = u.y; z.tik++;',
        '    if (Math.hypot(u.targetX - z.sonHx, u.targetY - z.sonHy) > 220) { z.degisim++; z.sonHx = u.targetX; z.sonHy = u.targetY; }',
        '  }',
        // ILK TEMAS: iki taraftan birimler ilk kez 500px'e girdiginde
        '  if (!senkron.true) {',
        '    let tx = null, ty = null;',
        '    const K = [], M = [];',
        '    for (const u of SIM.units) { if (u.dead || u.loaded) continue; (u.isRed ? K : M).push(u); }',
        '    for (const a of K) { for (const b of M) { if (Math.hypot(a.x - b.x, a.y - b.y) <= 500) { tx = (a.x + b.x) / 2; ty = (a.y + b.y) / 2; break; } } if (tx != null) break; }',
        '    if (tx != null) {',
        '      for (const kirmizi of [true, false]) {',
        '        const kendi = (kirmizi ? K : M).filter(u => STATS[u.type] && STATS[u.type].weapons && STATS[u.type].weapons.length);',
        '        const yakin = kendi.filter(u => Math.hypot(u.x - tx, u.y - ty) <= 600).length;',
        '        const mesafeler = kendi.map(u => Math.hypot(u.x - tx, u.y - ty)).sort((p, q) => p - q);',
        '        const med = mesafeler.length ? mesafeler[Math.floor(mesafeler.length / 2)] : 0;',
        '        senkron[kirmizi ? "true" : "false"] = { sn: Math.round(SIM.tick * 0.05), n: kendi.length,',
        '          yakin600: yakin, oran: kendi.length ? +(yakin / kendi.length).toFixed(3) : 0,',
        '          medyanMesafe: Math.round(med) };',
        '      }',
        '    }',
        '  }',
        '} } finally { SIM.headless = ph; }',
        'const cikti = { true: { degisim: 0, israf: 0, n: 0 }, false: { degisim: 0, israf: 0, n: 0 } };',
        'for (const z of iz.values()) {',
        '  if (z.tik < 200) continue;',
        '  const net = Math.hypot(z.px - z.bx, z.py - z.by);',
        '  const c = cikti[z.kirmizi ? "true" : "false"];',
        '  c.degisim += z.degisim / (z.tik * 0.05 / 60);',   // degisim/dk
        '  c.israf += z.yol / Math.max(1, net);',            // katedilen / net (1 = duz gitti)
        '  c.n++;',
        '}',
        'return JSON.stringify({ calkanti: cikti, senkron: senkron });',
        '})()'
    ].join('\n');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'kd.js' }));
}

const kova = { pro: { degisim: [], israf: [], oran: [], medyan: [], sn: [] }, intel4: { degisim: [], israf: [], oran: [], medyan: [], sn: [] } };
let mac = 0;
console.log('KARAR DONGUSU — ' + TOHUMLAR.length + ' tohum x 2 rol x 2 taraf = ' + (TOHUMLAR.length * 4) + ' mac');
for (const s of TOHUMLAR) for (const kirmiziSaldiran of [true, false]) for (const proK of [true, false]) {
    const r = kos(s, kirmiziSaldiran, proK); mac++;
    for (const k of ['true', 'false']) {
        const beyin = ((k === 'true') === proK) ? 'pro' : 'intel4';
        const c = r.calkanti[k];
        if (c && c.n) { kova[beyin].degisim.push(c.degisim / c.n); kova[beyin].israf.push(c.israf / c.n); }
        const sn = r.senkron[k];
        if (sn) { kova[beyin].oran.push(sn.oran); kova[beyin].medyan.push(sn.medyanMesafe); kova[beyin].sn.push(sn.sn); }
    }
    if (mac % 8 === 0) { try { fs.writeSync(1, '    ...' + mac + '/' + (TOHUMLAR.length * 4) + '\n'); } catch (e) {} }
}
const ort = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
console.log('');
console.log('  (A) EMIR CALKANTISI              (B) ILK TEMASTA VARIS SENKRONU');
console.log('  beyin     hedefDeg/dk  yolIsrafi | 600px-icinde%  medyanMesafe  temasSn');
for (const b of ['pro', 'intel4']) {
    const k = kova[b];
    console.log('  ' + b.padEnd(10) + ort(k.degisim).toFixed(2).padStart(10) + ort(k.israf).toFixed(2).padStart(11) +
        ' | ' + (Math.round(ort(k.oran) * 100) + '%').padStart(12) + String(Math.round(ort(k.medyan))).padStart(14) +
        String(Math.round(ort(k.sn))).padStart(9));
}
try { fs.mkdirSync('qa-runtime', { recursive: true }); } catch (e) {}
fs.writeFileSync('qa-runtime/karar-dongusu.json', JSON.stringify(kova, null, 2), 'utf8');
console.log('');
console.log('  OKUMA: hedefDeg/dk yuksekse (A) calkanti; 600px-icinde% dusukse (B) senkron sorunu.');
console.log('  -> qa-runtime/karar-dongusu.json');
