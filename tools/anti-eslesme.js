// ANTI-ESLESME OLCUMU — "kutle" nicel mi nitel mi?
//
// KULLANICI TEZI (2026-08-09): "AI gordugu tum alanlarda karsi tarafa ANTI olan birliklerini vs
// attirmali. Kutleyi buyutucem diye piyadeleri dolaylinin onune koyarsan olurler; dolaylilar tanka
// vurursa hicbir sey olmaz. Hali hazirdaki birimleri oyuncuya karsi ANTI kullansin."
//
// Mevcut iki pro kurali da SAYI sayiyor:
//   assaultCohesion : yakinda >=N dost var mi        (Unit.js:1575)
//   localRatio      : yakin dost/dusman orani        (Unit.js:1617)
// Ikisi de "5 piyade 3 tanka karsi" durumunu 1.67 ile IYI gorur — oysa piyade tanka hicbir sey yapamaz.
//
// BU ARAC OLCER (iddia etmez): her temas orneginde
//   sayiOran  = (yakin dost + 1) / yakin dusman                       [mevcut kuralin gordugu]
//   etkiOran  = SUM(dost DPS -> yerel dusman karisimi)
//               / SUM(dusman DPS -> yerel dost karisimi)              [gercek dovus gucu]
//   israf%    = yakin dostlarin, yerel dusman karisimina karsi DPS'i kendi EN IYI hedefine
//               karsi DPS'inin %20'sinden az olanlarin orani           [yanlis alet]
// Sayi-orani iyi ama etki-orani kotu ise kullanicinin tezi DOGRULANIR ve odul buyuklugu olculur.
//
// Kullanim: node tools/anti-eslesme.js [--tohum 4]
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 4)) || 4);
const HAVUZ = []; for (let i = 0; i < 96; i++) HAVUZ.push(100000 + i * 137);
const TOHUMLAR = HAVUZ.slice(0, N);
const R = Number(arg('--yaricap', 300));

const { ctx } = tezgahKur();

function kos(seed, kirmiziSaldiran, proKirmizi) {
    const kod = [
        '(() => {',
        'BATTLE_RECIPE_RED = null;',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;',
        'BATTLE_INTEL4PRO_RED = ' + (proKirmizi ? 'true' : 'false') + ';',
        'BATTLE_INTEL4PRO_BLUE = ' + (proKirmizi ? 'false' : 'true') + ';',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ', pro:' + (!proKirmizi) + ' }), false, { source:"ae", ally:true });',
        'startBattle();',
        // ── DPS(saldiran tipi -> hedef tipi): motorun KENDI hasar matrisinden. BattleForecast.js ile ayni
        //    formul; o dosya oyunda yuklu degil, bu yuzden burada yeniden kuruluyor (tek kaynak: damageMatrix).
        'const DM = (typeof UNITS_MODERN_DB !== "undefined") ? UNITS_MODERN_DB.damageMatrix : null;',
        'const _dpsCache = new Map();',
        'function dpsVs(aTip, hTip) {',
        '  const k = aTip + "|" + hTip; if (_dpsCache.has(k)) return _dpsCache.get(k);',
        '  const A = STATS[aTip], H = STATS[hTip]; let dps = 0;',
        '  if (A && H && DM) { const arm = H.armorType || "infantry";',
        '    for (const w of (A.weapons || [])) {',
        '      if (!w || !(w.damage > 0)) continue;',
        '      if (typeof weaponCanEngage === "function" && !weaponCanEngage(w, H)) continue;',
        '      const eff = (DM[w.damageType] || {})[arm] || 0; if (eff <= 0) continue;',
        '      const rof = (w.rof > 0) ? w.rof : 1, perShot = (w.perShot > 0) ? w.perShot : 1;',
        '      const isabet = (w.accuracy && Number.isFinite(w.accuracy.base)) ? Math.max(0.05, Math.min(1, w.accuracy.base)) : 1;',
        '      dps += w.damage * eff * rof * perShot * isabet; } }',
        '  _dpsCache.set(k, dps); return dps;',
        '}',
        // her tipin EN IYI hedefe karsi DPS'i (israf olcutunun paydasi)
        'const _enIyi = new Map();',
        'function enIyiDps(aTip) {',
        '  if (_enIyi.has(aTip)) return _enIyi.get(aTip);',
        '  let m = 0; for (const t in STATS) { const v = dpsVs(aTip, Number(t)); if (v > m) m = v; }',
        '  _enIyi.set(aTip, m); return m;',
        '}',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'const ornek = { true: [], false: [] };',
        'const olum = { true: [], false: [] };',
        'let onceki = new Set(SIM.units.filter(u => !u.dead).map(u => u.id));',
        'const son = new Map(); for (const u of SIM.units) son.set(u.id, { x:u.x, y:u.y, r:u.isRed, t:u.type });',
        'const R = ' + R + ';',
        // yerel kesit: bir noktadaki dost/dusman listesi + iki oran
        'function kesit(px, py, kirmizi, kendiTip) {',
        '  const dost = [], dus = [];',
        '  for (const o of SIM.units) { if (o.dead || o.loaded || o.abandoned) continue;',
        '    if (Math.hypot(o.x - px, o.y - py) > R) continue;',
        '    (o.isRed === kirmizi ? dost : dus).push(o); }',
        '  if (!dus.length) return null;',
        '  let dostDps = 0, dusDps = 0, israfli = 0, sayilan = 0;',
        '  const hepsi = kendiTip != null ? dost.concat([{ type: kendiTip, isRed: kirmizi }]) : dost;',
        '  for (const f of hepsi) {',
        '    let d = 0; for (const e of dus) d += dpsVs(f.type, e.type);',
        '    d /= dus.length; dostDps += d; sayilan++;',
        '    const iyi = enIyiDps(f.type); if (iyi > 0 && d < 0.20 * iyi) israfli++;',
        '  }',
        '  for (const e of dus) { let d = 0; for (const f of hepsi) d += dpsVs(e.type, f.type);',
        '    dusDps += hepsi.length ? d / hepsi.length : 0; }',
        '  return { dost: hepsi.length, dus: dus.length, dostDps: dostDps, dusDps: dusDps,',
        '    israfli: israfli, sayilan: sayilan };',
        '}',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '  const simdi = new Set(); for (const u of SIM.units) if (!u.dead) simdi.add(u.id);',
        '  for (const id of onceki) if (!simdi.has(id)) { const p = son.get(id); if (!p) continue;',
        '    const k = kesit(p.x, p.y, p.r, p.t); if (k) olum[p.r ? "true" : "false"].push(k); }',
        '  onceki = simdi;',
        '  for (const u of SIM.units) if (!u.dead) son.set(u.id, { x:u.x, y:u.y, r:u.isRed, t:u.type });',
        '  if (SIM.tick % 20) continue;',
        '  for (const u of SIM.units) {',
        '    if (u.dead || u.loaded || u.abandoned) continue;',
        '    let temas = false;',
        '    for (const o of SIM.units) { if (o.dead || o.loaded || o.isRed === u.isRed) continue;',
        '      if (Math.hypot(o.x - u.x, o.y - u.y) <= Math.max(u.range || 0, 260)) { temas = true; break; } }',
        '    if (!temas) continue;',
        '    const k = kesit(u.x, u.y, u.isRed, u.type); if (k) ornek[u.isRed ? "true" : "false"].push(k);',
        '  }',
        '} } finally { SIM.headless = ph; }',
        'return JSON.stringify({ ornek: ornek, olum: olum });',
        '})()'
    ].join('\n');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'ae.js' }));
}

const kova = { 'pro|temas': [], 'intel4|temas': [], 'pro|olum': [], 'intel4|olum': [] };
console.log('ANTI-ESLESME — ' + TOHUMLAR.length + ' tohum x 2 rol x 2 taraf, yerel yaricap ' + R + 'px');
let mac = 0;
for (const s of TOHUMLAR) for (const kirmiziSaldiran of [true, false]) for (const proK of [true, false]) {
    const r = kos(s, kirmiziSaldiran, proK); mac++;
    for (const k of ['true', 'false']) {
        const beyin = ((k === 'true') === proK) ? 'pro' : 'intel4';
        for (const o of r.ornek[k]) kova[beyin + '|temas'].push(o);
        for (const o of r.olum[k]) kova[beyin + '|olum'].push(o);
    }
    if (mac % 8 === 0) { try { fs.writeSync(1, '    ...' + mac + '/' + (TOHUMLAR.length * 4) + '\n'); } catch (e) {} }
}
const ort = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
function ozet(a) {
    if (!a.length) return null;
    const sayi = a.map(x => x.dost / Math.max(1, x.dus));
    const etki = a.filter(x => x.dusDps > 0).map(x => x.dostDps / x.dusDps);
    const israf = a.map(x => x.sayilan ? x.israfli / x.sayilan : 0);
    // "sayi iyi ama etki kotu" — kuralin KANDIGI ornekler
    const kandi = a.filter(x => x.dusDps > 0 && (x.dost / Math.max(1, x.dus)) >= 1.5 && (x.dostDps / x.dusDps) < 1.0);
    return { n: a.length, sayiOran: +ort(sayi).toFixed(2), etkiOran: +ort(etki).toFixed(2),
        israf: +(ort(israf) * 100).toFixed(1), kandi: +(kandi.length / a.length * 100).toFixed(1) };
}
console.log('');
console.log('  kova              n       sayiOran  etkiOran   israf%   "sayi iyi/etki kotu"%');
for (const k of Object.keys(kova)) {
    const o = ozet(kova[k]);
    if (!o) { console.log('  ' + k.padEnd(16) + '(veri yok)'); continue; }
    console.log('  ' + k.padEnd(16) + String(o.n).padStart(6) + String(o.sayiOran).padStart(13) +
        String(o.etkiOran).padStart(10) + String(o.israf + '%').padStart(9) + String(o.kandi + '%').padStart(22));
}
try { fs.mkdirSync('qa-runtime', { recursive: true }); } catch (e) {}
fs.writeFileSync('qa-runtime/anti-eslesme.json', JSON.stringify(
    Object.fromEntries(Object.entries(kova).map(([k, v]) => [k, ozet(v)])), null, 2), 'utf8');
console.log('');
console.log('  OKUMA: sayiOran >= 1.5 iken etkiOran < 1.0 olan ornekler, mevcut SAYI-tabanli kurallarin');
console.log('         "iyi durum" sandigi ama gercekte KAYBEDILEN yerel dovuslerdir.');
console.log('  -> qa-runtime/anti-eslesme.json');
