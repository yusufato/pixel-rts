// HAVA-HAVA TESHISI — "helo, heloyu vurabiliyor mu?" (kullanici hata bildirimi)
//
// OLCULEN HATA: havaya ates edebilen YALNIZ manpads/spaag/sam_battery vardi. Taarruz helosunun ATGM podu
// ve SIHA'nin hassas muhimmati targets:["ground"] idi; ustelik damageMatrix'te shaped->air = 0. Yani iki
// hava birimi birbirini HEDEF BILE EDINEMIYORDU.
//
// Bu arac uc seyi AYRI AYRI sayar (mekanizma metrigi — mac sonucu degil, tuzak A1):
//   1. hava->hava ATIS sayisi (SECONDARY_FIRE, hedef hava)
//   2. hava->hava OLDURME sayisi
//   3. helonun hava hedefine kilitlendigi tik orani (avlama davranisi)
// ve ayni tohumlari BATTLE_HAVA_HAVA acik/kapali kosarak eslestirilmis fark verir.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 8)) || 8);
const HAVUZ = [202, 2024, 3141, 777, 11, 333, 4001, 4003, 4007, 4013, 4019, 4021];
const TOHUMLAR = HAVUZ.slice(0, N);

const { ctx } = tezgahKur();

function kos(havaHava, seed) {
    const kod = [
        '(() => {',
        'BATTLE_HAVA_HAVA = ' + havaHava + ';',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;',
        // SIMETRI: iki tarafa da AYNI beyin. Aksi halde marj farki beyin asimetrisiyle karisir ve
        // "mekanik bir tarafi kayiriyor mu" sorusu olculemez (tuzak: kolun tek degiskeni olmali).
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'BATTLE_BEONAI_RED = null; BATTLE_BEONAI_BLUE = null;',
        // HAVA GARANTISI: rastgele kadroda helo cikmayabilir; iki tarafa da hava birimi ZORLA (bind kaniti).
        'const _HAVA = { ad:"HAVA", rol:"any", tavan:{}, artik:[], zorunlu:{ attack_helo:2, armed_uav:1, recon_uav:1,',
        '  transport_helo:1, infantry:4, mbt:2, ifv:1, at_team:2, mortar_team:2, supply_truck:1, manpads_team:1 } };',
        'BATTLE_RECIPE_RED = _HAVA;',   // KIRMIZIYA DA hava zorla — yoksa AI kadrosu neredeyse hiç helo almıyor
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false, recipe: _HAVA }), false, { source:"hh", ally:true });',
        'startBattle();',
        'BATTLE_RECIPE_RED = null;',
        // BAGLANMA KANITI (tuzak B2): iki tarafta da SILAHLI hava birimi var mi?
        'const _kadro = (kk) => { const o = {}; for (const u of SIM.units) { if (!!u.isRed !== kk) continue;',
        '  const s = STATS[u.type] || {}; if (s.domain !== "air") continue; const id = s.id || u.type; o[id] = (o[id]||0)+1; } return o; };',
        'const _kadroM = _kadro(false), _kadroK = _kadro(true);',
        // KIRMIZI tarafa da hava koy (kadro tarifi yalnız maviye uygulandi) — sayim iki tarafli olsun
        'const _sayHava = (kirmizi) => SIM.units.filter(u => !u.dead && !!u.isRed === kirmizi && u.isAir).length;',
        'const _bas = { m: _sayHava(false), k: _sayHava(true) };',
        // ── SAYAC: hava->hava atis/oldurme, helo hava-hedef kilit orani ──
        'let kilitHava = 0, kilitTop = 0, yakinOrnek = 0, ornek = 0;',
        'const _olcTik = () => {',
        '  for (const u of SIM.units) {',
        '    if (u.dead || !u.isAir || !STATS[u.type] || !STATS[u.type].weapons.length) continue;',
        '    kilitTop++;',
        '    if (u.attackTarget && !u.attackTarget.dead && u.attackTarget.isAir) kilitHava++;',
        '  }',
        // TEMAS FIRSATI: iki tarafın havaları hava-hava menziline (675px) hiç giriyor mu?
        '  const hm = SIM.units.filter(u => !u.dead && !u.isRed && u.isAir);',
        '  const hk = SIM.units.filter(u => !u.dead && u.isRed && u.isAir);',
        '  if (!hm.length || !hk.length) return;',
        '  ornek++;',
        '  let en = 1e9;',
        '  for (const a of hm) for (const b of hk) { const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < en) en = d; }',
        '  if (en <= 675) yakinOrnek++;',
        '};',
        'const ph2 = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  const once = SIM.pendingHitSeq;',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '  if (SIM.tick % 20 === 0) _olcTik();',
        '} } finally { SIM.headless = ph2; }',
        'const kalanHava = { m: _sayHava(false), k: _sayHava(true) };',
        'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);',
        'return JSON.stringify({ havaBas: _bas, havaKalan: kalanHava, kadroM: _kadroM, kadroK: _kadroK,',
        '  havaKayip: (_bas.m - kalanHava.m) + (_bas.k - kalanHava.k),',
        '  kilitHavaPct: kilitTop ? +(kilitHava / kilitTop * 100).toFixed(1) : 0,',
        '  temasPct: ornek ? +(yakinOrnek / ornek * 100).toFixed(1) : 0,',
        '  marj: Math.round(oS.effectiveValue - oD.effectiveValue), sure: Math.round(SIM.tick * 0.05) });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'hh.js' }));
}

console.log('HAVA-HAVA TESHISI — ' + TOHUMLAR.length + ' tohum, iki tarafta da hava birimi ZORLANDI');
console.log('  soru: helo/SIHA hava hedefine kilitlenip vuruyor mu (mekanizma), ve mac sonucu ne kadar kaydi');
console.log('');
console.log('  ' + 'kol'.padEnd(16) + 'hava kilit%'.padStart(13) + 'temas%'.padStart(9) +
    'hava kayip'.padStart(12) + 'ort.sure'.padStart(10) + 'ort.marj'.padStart(10));
const sonuc = {};
for (const [ad, bayrak] of [['KAPALI (taban)', false], ['ACIK (yeni)', true]]) {
    const r = TOHUMLAR.map(s => kos(bayrak, s));
    sonuc[ad] = r;
    const o = f => r.reduce((a, x) => a + x[f], 0) / r.length;
    console.log('  ' + ad.padEnd(16) + o('kilitHavaPct').toFixed(1).padStart(13) +
        o('temasPct').toFixed(1).padStart(9) +
        o('havaKayip').toFixed(1).padStart(12) + Math.round(o('sure')).toString().padStart(10) +
        Math.round(o('marj')).toString().padStart(10));
    if (ad.startsWith('KAPALI')) {
        const g = (x) => Object.entries(x).sort().map(([a, n]) => a + ' ' + n).join(', ');
        console.log('    BAGLANMA KANITI — MAVI hava: ' + (g(r[0].kadroM) || 'YOK'));
        console.log('                      KIRMIZI hava: ' + (g(r[0].kadroK) || 'YOK'));
    }
}
console.log('');
const t = sonuc['KAPALI (taban)'], y = sonuc['ACIK (yeni)'];
const f = y.map((x, i) => x.marj - t[i].marj);
const ort = f.reduce((a, b) => a + b, 0) / f.length;
const std = Math.sqrt(f.reduce((a, b) => a + (b - ort) * (b - ort), 0) / Math.max(1, f.length - 1));
console.log('  ESLESTIRILMIS MARJ FARKI: ' + (ort > 0 ? '+' : '') + Math.round(ort) +
    '   std.hata ' + Math.round(std / Math.sqrt(f.length)) + '   lehte ' + f.filter(x => x > 0).length + '/' + f.length);
console.log('');
console.log('  OKUMA: "hava kilit%" KAPALI kolda ~0 olmali (hava birimi hava hedefi edinemez).');
console.log('         ACIK kolda >0 ise mekanizma calisiyor. Marj farki ~0 ise mekanik SIMETRIK —');
console.log('         yani yeni yetenek bir tarafi kayirmiyor (istenen: hata duzeltmesi, denge kaymasi degil).');
