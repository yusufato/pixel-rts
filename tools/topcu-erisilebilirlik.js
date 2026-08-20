#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════════
   DUSMAN TOPCUSU ERISILEBILIR MI — standoff'un gercek kok nedeni hangisi?

   Iki rakip aciklama var ve ikisi de kayitlarda YAZILI:
     (A) "toplar GORUNMEZ" — karsi-plan calismasin diye tespit/inanc gerekiyor.
     (B) js/UnitData.js:205 yorumu: "dusman dolaylisi ATES ETTIGI ANDA zaten %100
         gorunur (176 atis olayi, 3 tohum)" — bu yuzden radar ifsa aurasi
         UYGULANMIYOR.
   Ikisi ayni anda dogru olamaz. Ve (B) 3 tohumluk; bu depoda 3 tohumluk okumalar
   defalarca yanildi. Varsaymak yerine olcuyoruz.

   ORNEK BASINA SORULAN:
     gorunur   : kirmizinin temas listesinde visible=true olan mavi dolayli var mi
     menzilde  : kirmizinin KENDI dolayli birimlerinin menzilinde mavi dolayli var mi
     gozcu     : artilleryHasSight kirmizinin topcusu icin o hedefe EVET diyor mu
     kilitli   : kirmizinin dolayli birimlerinden kaci fiilen mavi dolayliyi hedefliyor

   Bu dordu "karsi-batarya neden olmuyor" sorusunu tek tek eler:
     gorunur=0        -> sorun GORME (inanc kanali gerekli)
     gorunur>0 menzil=0 -> sorun MENZIL (yaklasmak ya da daha uzun namlu gerekli)
     menzil>0 gozcu=0 -> sorun GOZCU KURALI
     gozcu>0 kilitli=0 -> sorun HEDEF ONCELIGI (mevcut bayrak tam da bunun icin)
   ═══════════════════════════════════════════════════════════════════════════════ */
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('node:fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 4)) || 4);
const TOHUM0 = Number(arg('--tohum0', 145000)) || 145000;

const { ctx } = tezgahKur();
const taban = JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));
const TARIF = Object.assign({}, taban, {
    ad: 'STANDOFF',
    zorunlu: Object.assign({}, taban.zorunlu, { artillery: 2, mortar_team: 3, mlrs: 1 })
});

function kos(seed) {
    const kod = '(() => {\n' +
'  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;\n' +
'  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;\n' +
'  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;\n' +
'  BATTLE_INTEL4_DELTAS.profile = true;\n' +
'  BATTLE_KARSI_PLAN = false;\n' +
'  BATTLE_RECIPE_BLUE = ' + JSON.stringify(TARIF) + ';\n' +
'  BATTLE_RECIPE_RED = null;\n' +
'  openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true,\n' +
'    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });\n' +
'  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;\n' +
'  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true,\n' +
'    varied:true, brainIntel4:true, isAttacker:false, recipe: BATTLE_RECIPE_BLUE }), false,\n' +
'    { source:"te", ally:true });\n' +
'  startBattle(); SIM.headless = true;\n' +
'  BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false;\n' +
'  let kirmizi = null;\n' +
'  for (const c of BATTLE_CONTROLLERS.values()) if (c && c.side === true) kirmizi = c;\n' +
'\n' +
'  let st = 0, orn = 0;\n' +
'  let gorunur = 0, menzilde = 0, gozcu = 0, kilitli = 0, kirmiziDolayliVar = 0;\n' +
'  let enYakinTop = 0, enYakinN = 0;\n' +
'  const neYapiyor = {}; let hedefMes = 0, hedefN = 0;\n' +
'\n' +
'  while (phase === PHASE.BATTLE && SIM.tick < 7200) {\n' +
'    if (SIM.battle && SIM.battle.winnerSide !== null) break;\n' +
'    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);\n' +
'    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);\n' +
'    if (SIM.tick % 40 !== 0) continue;\n' +
'    orn++;\n' +
'\n' +
'    const maviTop = [];\n' +
'    for (const u of SIM.units) {\n' +
'      if (u.dead || u.abandoned || u.loaded || u.isRed || !u.isIndirect) continue;\n' +
'      maviTop.push(u);\n' +
'    }\n' +
'    if (!maviTop.length) continue;\n' +
'\n' +
'    /* 1) GORUNUR MU — kirmizinin temas listesi */\n' +
'    const temas = (kirmizi.lastObservation && kirmizi.lastObservation.contacts) || [];\n' +
'    const gorunenId = {};\n' +
'    for (const c of temas) if (c.visible === true) gorunenId[c.id] = 1;\n' +
'    let gVar = false;\n' +
'    for (const u of maviTop) if (gorunenId[u.id]) { gVar = true; break; }\n' +
'    if (gVar) gorunur++;\n' +
'\n' +
'    /* 2) MENZILDE MI + 3) GOZCU VAR MI — kirmizinin KENDI dolayli birimleri */\n' +
'    let mVar = false, goVar = false, kVar = false, dolayliVar = false;\n' +
'    let yakin = 1e9;\n' +
'    for (const r of SIM.units) {\n' +
'      if (r.dead || r.abandoned || r.loaded || !r.isRed || !r.isIndirect) continue;\n' +
'      dolayliVar = true;\n' +
'      for (const u of maviTop) {\n' +
'        const d = Math.hypot(u.x - r.x, u.y - r.y);\n' +
'        if (d < yakin) yakin = d;\n' +
'        if (d <= (r.range || 0)) {\n' +
'          mVar = true;\n' +
'          if (typeof artilleryHasSight === "function" && artilleryHasSight(r, u)) goVar = true;\n' +
'        }\n' +
'      }\n' +
'      if (r.attackTarget && !r.attackTarget.isRed && r.attackTarget.isIndirect) kVar = true;\n' +
'      /* Kirmizi topcusu O AN ne yapiyor: hedef tipi (ya da bos ise combatState) */\n' +
'      const _et = r.attackTarget ? ("tip" + r.attackTarget.type) : ("BOS:" + (r.combatState || "?"));\n' +
'      neYapiyor[_et] = (neYapiyor[_et] || 0) + 1;\n' +
'      if (r.attackTarget) { hedefMes += Math.hypot(r.attackTarget.x - r.x, r.attackTarget.y - r.y); hedefN++; }\n' +
'    }\n' +
'    if (dolayliVar) kirmiziDolayliVar++;\n' +
'    if (mVar) menzilde++;\n' +
'    if (goVar) gozcu++;\n' +
'    if (kVar) kilitli++;\n' +
'    if (yakin < 1e9) { enYakinTop += yakin; enYakinN++; }\n' +
'  }\n' +
'  let rMenzil = 0, rN = 0;\n' +
'  for (const r of SIM.units) if (r.isRed && r.isIndirect) { rMenzil += (r.range || 0); rN++; }\n' +
'  return JSON.stringify({ orn: orn, gorunur: gorunur, menzilde: menzilde, gozcu: gozcu,\n' +
'    kilitli: kilitli, kirmiziDolayliVar: kirmiziDolayliVar,\n' +
'    enYakin: enYakinN ? enYakinTop / enYakinN : null,\n' +
'    kirmiziTopMenzil: rN ? rMenzil / rN : 0, kirmiziTopSayi: rN,\n' +
'    neYapiyor: neYapiyor, hedefMes: hedefN ? hedefMes / hedefN : null });\n' +
'})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'te-' + seed + '.js' }));
}

console.log('');
console.log('DUSMAN TOPCUSU ERISILEBILIR MI   ' + MAC + ' tohum   (karsi-plan KAPALI, taban davranis)');
console.log('');
const T = { orn: 0, gorunur: 0, menzilde: 0, gozcu: 0, kilitli: 0, dolayliVar: 0 };
const ny = {};
let yakinTop = 0, yakinN = 0, menzilTop = 0, menzilN = 0, hmTop = 0, hmN = 0;
for (let i = 0; i < MAC; i++) {
    const r = kos(TOHUM0 + i);
    T.orn += r.orn; T.gorunur += r.gorunur; T.menzilde += r.menzilde;
    T.gozcu += r.gozcu; T.kilitli += r.kilitli; T.dolayliVar += r.kirmiziDolayliVar;
    if (r.enYakin != null) { yakinTop += r.enYakin; yakinN++; }
    menzilTop += r.kirmiziTopMenzil; menzilN++;
    for (const k of Object.keys(r.neYapiyor || {})) ny[k] = (ny[k] || 0) + r.neYapiyor[k];
    if (r.hedefMes != null) { hmTop += r.hedefMes; hmN++; }
    const p = (x) => r.orn ? (100 * x / r.orn).toFixed(0).padStart(3) + '%' : '  —';
    console.log('  tohum ' + (TOHUM0 + i) + '  ornek ' + String(r.orn).padStart(3) +
        '   gorunur ' + p(r.gorunur) + '   menzilde ' + p(r.menzilde) +
        '   gozcu ' + p(r.gozcu) + '   kilitli ' + p(r.kilitli) +
        '   enYakin ' + (r.enYakin == null ? '—' : Math.round(r.enYakin)) + 'px' +
        '   kirmizi topcu ' + r.kirmiziTopSayi + ' (menzil ' + Math.round(r.kirmiziTopMenzil) + ')');
}
const P = (x) => T.orn ? (100 * x / T.orn).toFixed(1) + '%' : '—';
console.log('');
console.log('  TOPLAM (' + T.orn + ' ornek)');
console.log('    mavi topcu GORUNUR      : ' + P(T.gorunur));
console.log('    kirmizi topcusu MENZILDE: ' + P(T.menzilde));
console.log('    GOZCU kurali saglaniyor : ' + P(T.gozcu));
console.log('    fiilen KILITLI          : ' + P(T.kilitli));
console.log('    (kirmizinin dolayli birimi var oldugu ornek: ' + P(T.dolayliVar) + ')');
console.log('    en yakin kirmizi topcu -> mavi topcu mesafesi: ' +
    (yakinN ? Math.round(yakinTop / yakinN) : '—') + 'px   ort. menzil ' +
    (menzilN ? Math.round(menzilTop / menzilN) : '—') + 'px');
console.log('');
console.log('  KIRMIZI TOPCUSU NE YAPIYOR (birim-ornegi basina, tum ornekler):');
const sirali = Object.keys(ny).sort((a, b) => ny[b] - ny[a]);
const nyToplam = sirali.reduce((a, k) => a + ny[k], 0) || 1;
for (const k of sirali.slice(0, 8)) {
    console.log('    ' + k.padEnd(24) + String(ny[k]).padStart(5) + '  (' + (100 * ny[k] / nyToplam).toFixed(1) + '%)');
}
console.log('    hedefe ort. mesafe: ' + (hmN ? Math.round(hmTop / hmN) : '—') + 'px');
console.log('');
console.log('  ELEME: gorunur=0 -> GORME sorunu · gorunur>0 & menzil=0 -> MENZIL sorunu');
console.log('         menzil>0 & gozcu=0 -> GOZCU KURALI · gozcu>0 & kilitli=0 -> HEDEF ONCELIGI');
