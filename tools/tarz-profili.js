// OYNAYIS TARZI PROFILI — intel4-pro vs intel4, IKI TARAFI DA GORELIM (seyirci gozu, sis yok).
//
// Kullanici: "iki AI'nin savasini kare kare izleyeceksin, senin icin sis yok, iki tarafi da gorup
// oynayis tarzinin profilini cikartacaksin." Gorsel izleme `--izle` ile yapildi; bu arac ayni maclari
// TIK cozunurlugunde SAYIYA cevirir (gozle gorulen sey olculmezse iddia olmaz).
//
// OLCULEN (her tarafta ayri, 10 tikte bir ornek):
//   yayilim        : birimlerin agirlik merkezine ort. uzakligi (dagilim mi kutle mi)
//   temasOran      : dusman menzilinde olan KENDI birimlerinin orani (kuvvetin yuzde kaci fiilen dovusuyor)
//   yerelOran      : temas noktasinda (300px) dost/dusman sayisi — "yerel ustunluk" (insanin kazanma tarzi)
//   ilerleme       : agirlik merkezinin dusman tabanina dogru kat ettigi yol
//   atesOran       : hedefi olan birim orani
//   parcaliTemas   : temasa GIREN birimlerin es-zamanli olmayisi (kac ayri "temas kumesi")
//   olumYereliOran : bir birim olurken 400px icinde dost/dusman orani (gafil mi avlandi, kutle mi eridi)
//
// Kullanim: node tools/tarz-profili.js [--tohum 6] [--atla 0] [--out qa-runtime/tarz-profili.json]
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 6)) || 6);
const ATLA = Math.max(0, Number(arg('--atla', 0)) || 0);
const OUT = arg('--out', 'qa-runtime/tarz-profili.json');
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
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ', pro:' + (!proKirmizi) + ' }), false, { source:"tp", ally:true });',
        'startBattle();',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        // baslangic agirlik merkezleri (ilerleme referansi)
        'const merkez = k => { const a = SIM.units.filter(u => !u.dead && !u.loaded && u.isRed === k);',
        '  if (!a.length) return null; return { x: a.reduce((s,u)=>s+u.x,0)/a.length, y: a.reduce((s,u)=>s+u.y,0)/a.length }; };',
        'const bas = { true: merkez(true), false: merkez(false) };',
        'const ilkSayi = { true: SIM.units.filter(u=>!u.dead&&u.isRed).length, false: SIM.units.filter(u=>!u.dead&&!u.isRed).length };',
        'const AC = { true: [], false: [] };',            // ornekler
        'const olum = { true: [], false: [] };',          // olum aninda yerel oran
        'let onceki = new Set(SIM.units.filter(u=>!u.dead).map(u=>u.id));',
        'const konum = new Map(); for (const u of SIM.units) konum.set(u.id, { x:u.x, y:u.y, r:u.isRed });',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        // OLUM ANI: bu tikte kaybolan birimin son konumunda 400px yerel oran
        '  const simdi = new Set();',
        '  for (const u of SIM.units) if (!u.dead) simdi.add(u.id);',
        '  for (const id of onceki) if (!simdi.has(id)) {',
        '    const p = konum.get(id); if (!p) continue;',
        '    let dost = 0, dus = 0;',
        '    for (const o of SIM.units) { if (o.dead || o.loaded) continue; const d = Math.hypot(o.x-p.x, o.y-p.y);',
        '      if (d > 400) continue; if (o.isRed === p.r) dost++; else dus++; }',
        '    olum[p.r ? "true" : "false"].push({ dost: dost, dus: dus, sn: Math.round(SIM.tick*0.05) });',
        '  }',
        '  onceki = simdi;',
        '  for (const u of SIM.units) if (!u.dead) konum.set(u.id, { x:u.x, y:u.y, r:u.isRed });',
        '  if (SIM.tick % 10) continue;',
        // ORNEK: her taraf icin tarz metrikleri
        '  for (const k of [true, false]) {',
        '    const a = SIM.units.filter(u => !u.dead && !u.loaded && u.isRed === k);',
        '    const b = SIM.units.filter(u => !u.dead && !u.loaded && u.isRed !== k);',
        '    if (!a.length || !b.length) continue;',
        '    const cx = a.reduce((s,u)=>s+u.x,0)/a.length, cy = a.reduce((s,u)=>s+u.y,0)/a.length;',
        '    const yay = Math.sqrt(a.reduce((s,u)=>s+(u.x-cx)**2+(u.y-cy)**2,0)/a.length);',
        '    let temas = 0, ates = 0, yerelDost = 0, yerelDus = 0, temasEden = [];',
        '    for (const u of a) {',
        '      if (u.attackTarget && !u.attackTarget.dead) ates++;',
        '      let yakin = false;',
        '      for (const o of b) if (Math.hypot(o.x-u.x, o.y-u.y) <= Math.max(u.range||0, 260)) { yakin = true; break; }',
        '      if (!yakin) continue;',
        '      temas++; temasEden.push(u);',
        '      for (const o of a) if (Math.hypot(o.x-u.x, o.y-u.y) <= 300) yerelDost++;',
        '      for (const o of b) if (Math.hypot(o.x-u.x, o.y-u.y) <= 300) yerelDus++;',
        '    }',
        // PARCALI TEMAS: temastaki birimleri 350px komsulukla kumele — kac ayri kume var?
        '    let kume = 0;',
        '    { const kalan = temasEden.slice();',
        '      while (kalan.length) { const yig = [kalan.pop()]; kume++;',
        '        while (yig.length) { const c = yig.pop();',
        '          for (let i = kalan.length-1; i >= 0; i--) if (Math.hypot(kalan[i].x-c.x, kalan[i].y-c.y) <= 350) yig.push(kalan.splice(i,1)[0]); } } }',
        '    const t0 = bas[k ? "true" : "false"], hedefY = k ? WORLD_H : 0;',
        '    const ilerleme = t0 ? Math.abs(cy - t0.y) : 0;',
        '    AC[k ? "true" : "false"].push({ sn: Math.round(SIM.tick*0.05), n: a.length, yayilim: Math.round(yay),',
        '      temas: temas, ates: ates, kume: kume, yerelDost: yerelDost, yerelDus: yerelDus, ilerleme: Math.round(ilerleme) });',
        '  }',
        '} } finally { SIM.headless = ph; }',
        'const oK = battleArmyObservation(true), oM = battleArmyObservation(false);',
        'const b = SIM.battle || {};',
        'return JSON.stringify({ marj: Math.round(oK.effectiveValue - oM.effectiveValue),',
        '  kazanan: b.winnerSide === true ? "kirmizi" : (b.winnerSide === false ? "mavi" : "berabere"),',
        '  sn: Math.round(b.elapsedSec || 0), ilkSayi: ilkSayi,',
        '  kalan: { true: SIM.units.filter(u=>!u.dead&&u.isRed).length, false: SIM.units.filter(u=>!u.dead&&!u.isRed).length },',
        '  ornek: AC, olum: olum });',
        '})()'
    ].join('\n');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'tp.js' }));
}

// TARAF DEGIL BEYIN bazinda topla: her ornek "pro" ya da "intel4" kovasina gider.
const kova = {
    pro: { saldiran: [], savunan: [], olum: [] },
    intel4: { saldiran: [], savunan: [], olum: [] }
};
let proGalip = 0, mac = 0;
const marjlar = [];

console.log('TARZ PROFILI — ' + TOHUMLAR.length + ' tohum x 2 rol x 2 taraf = ' + (TOHUMLAR.length * 4) + ' mac');
for (const s of TOHUMLAR) for (const kirmiziSaldiran of [true, false]) for (const proK of [true, false]) {
    const r = kos(s, kirmiziSaldiran, proK);
    mac++;
    marjlar.push(proK ? r.marj : -r.marj);
    if ((proK && r.kazanan === 'kirmizi') || (!proK && r.kazanan === 'mavi')) proGalip++;
    for (const k of ['true', 'false']) {
        const kirmizi = k === 'true';
        const beyin = (kirmizi === proK) ? 'pro' : 'intel4';
        const rol = (kirmizi === kirmiziSaldiran) ? 'saldiran' : 'savunan';
        for (const o of r.ornek[k]) kova[beyin][rol].push(o);
        for (const o of r.olum[k]) kova[beyin].olum.push(o);
    }
    if (mac % 8 === 0) { try { fs.writeSync(1, '    ...' + mac + '/' + (TOHUMLAR.length * 4) + '\n'); } catch (e) {} }
}

const ort = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
function ozet(ornekler) {
    if (!ornekler.length) return null;
    const temasOran = ornekler.map(o => o.n ? o.temas / o.n : 0);
    const yerel = ornekler.filter(o => o.yerelDus > 0).map(o => o.yerelDost / o.yerelDus);
    return {
        ornek: ornekler.length,
        yayilim: Math.round(ort(ornekler.map(o => o.yayilim))),
        temasOran: +(ort(temasOran)).toFixed(3),
        atesOran: +(ort(ornekler.map(o => o.n ? o.ates / o.n : 0))).toFixed(3),
        temasKumesi: +(ort(ornekler.map(o => o.kume))).toFixed(2),
        yerelOran: +(ort(yerel)).toFixed(2),
        ilerleme: Math.round(ort(ornekler.map(o => o.ilerleme)))
    };
}
function olumOzet(o) {
    if (!o.length) return null;
    const oran = o.map(x => x.dus > 0 ? x.dost / x.dus : 99);
    const gafil = o.filter(x => x.dost <= 1 && x.dus >= 2).length;   // yalniz + kalabaligin icinde oldu
    return { olum: o.length, yerelOran: +(ort(oran.filter(v => v < 90))).toFixed(2),
        gafilOran: +(gafil / o.length).toFixed(3), ortSn: Math.round(ort(o.map(x => x.sn))) };
}

const rapor = {
    mac, proGalip, proYuzde: Math.round(proGalip / mac * 100),
    marjOrt: Math.round(ort(marjlar)),
    pro: { saldiran: ozet(kova.pro.saldiran), savunan: ozet(kova.pro.savunan), olum: olumOzet(kova.pro.olum) },
    intel4: { saldiran: ozet(kova.intel4.saldiran), savunan: ozet(kova.intel4.savunan), olum: olumOzet(kova.intel4.olum) }
};
try { fs.mkdirSync('qa-runtime', { recursive: true }); } catch (e) {}
fs.writeFileSync(OUT, JSON.stringify(rapor, null, 2), 'utf8');

const yaz = (ad, o) => {
    if (!o) { console.log('  ' + ad.padEnd(18) + '(veri yok)'); return; }
    console.log('  ' + ad.padEnd(18) +
        'yayilim ' + String(o.yayilim).padStart(4) +
        '   temas% ' + String(Math.round(o.temasOran * 100)).padStart(3) +
        '   ates% ' + String(Math.round(o.atesOran * 100)).padStart(3) +
        '   temasKumesi ' + String(o.temasKumesi).padStart(5) +
        '   yerelOran ' + String(o.yerelOran).padStart(5) +
        '   ilerleme ' + String(o.ilerleme).padStart(4));
};
console.log('');
console.log('  ══ SONUC: pro ' + proGalip + '/' + mac + ' = %' + rapor.proYuzde + '   marj ' + (rapor.marjOrt > 0 ? '+' : '') + rapor.marjOrt + ' ══');
console.log('');
console.log('  ── TARZ (tik ornekleri, beyin bazinda) ──');
yaz('pro SALDIRAN', rapor.pro.saldiran);
yaz('intel4 SALDIRAN', rapor.intel4.saldiran);
yaz('pro SAVUNAN', rapor.pro.savunan);
yaz('intel4 SAVUNAN', rapor.intel4.savunan);
console.log('');
console.log('  ── OLUM ANI (400px yerel oran; gafilOran = yalniz olup kalabaliga yakalanma) ──');
for (const b of ['pro', 'intel4']) {
    const o = rapor[b].olum;
    console.log('  ' + b.padEnd(18) + (o ? ('olum ' + String(o.olum).padStart(4) + '   yerelOran ' + String(o.yerelOran).padStart(5) +
        '   gafil% ' + String(Math.round(o.gafilOran * 100)).padStart(3) + '   ortSn ' + o.ortSn) : '(veri yok)'));
}
console.log('');
console.log('  -> ' + OUT);
