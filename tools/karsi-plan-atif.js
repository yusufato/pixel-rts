#!/usr/bin/env node
/* KARSI-PLAN ATIF PROBU — "hangi parca ne yapiyor" sorusu.
   Karsi-plan iki sey degistiriyordu: (a) yayilma yerine konsantrasyon, (b) FLANK'a
   derin nisan. Mekanizma olcumu kutlenin UZAKLASTIGINI gosterdi. Once sunu bilmek
   gerek: derin nisan HIC uygulaniyor mu, yoksa tum etki (a)'dan mi geliyor?
   Ayrica ortalama mesafe yaniltici olabilir — kanat baskini ORTALAMAYI degil
   EN YAKIN birimi degistirir. O yuzden min mesafe ve yakin-birim sayisi da olculur. */
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('node:fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 3)) || 3);
const TOHUM0 = Number(arg('--tohum0', 143000)) || 143000;
const KAPSAM = arg('--kapsam', 'flank');

const { ctx } = tezgahKur();
const taban = JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));
const TARIF = Object.assign({}, taban, {
    ad: 'STANDOFF',
    zorunlu: Object.assign({}, taban.zorunlu, { artillery: 2, mortar_team: 3, mlrs: 1 })
});

function kos(seed, karsiPlan) {
    const kod = '(() => {\n' +
'  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;\n' +
'  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;\n' +
'  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;\n' +
'  BATTLE_INTEL4_DELTAS.profile = true;\n' +
'  BATTLE_KARSI_PLAN = ' + (karsiPlan ? 'true' : 'false') + ';\n' +
'  BATTLE_KARSI_PLAN_KAPSAM = "' + KAPSAM + '";\n' +
'  BATTLE_KP_TELEMETRI = { sorgu:0, aktif:0, nisan:0, baskin:0, cagri:0, engelVarildi:0, engelYenile:0, kilitli:0, ornek:[] };\n' +
'  BATTLE_RECIPE_BLUE = ' + JSON.stringify(TARIF) + ';\n' +
'  BATTLE_RECIPE_RED = null;\n' +
'  openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true,\n' +
'    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });\n' +
'  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;\n' +
'  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true,\n' +
'    varied:true, brainIntel4:true, isAttacker:false, recipe: BATTLE_RECIPE_BLUE }), false,\n' +
'    { source:"kpa", ally:true });\n' +
'  startBattle(); SIM.headless = true;\n' +
'  BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false;\n' +
'  let kirmizi = null;\n' +
'  for (const c of BATTLE_CONTROLLERS.values()) if (c && c.side === true) kirmizi = c;\n' +
'  let st = 0, orn = 0;\n' +
'  let mTop=0, minTop=0, yakinTop=0, yTop=0, kayYTop=0;\n' +
'  const roller = {};\n' +
'  while (phase === PHASE.BATTLE && SIM.tick < 7200) {\n' +
'    if (SIM.battle && SIM.battle.winnerSide !== null) break;\n' +
'    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);\n' +
'    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);\n' +
'    if (SIM.tick % 40 !== 0) continue;\n' +
'    /* hangi gruplar var: rol dagilimini kaydet (FLANK gercekten olusuyor mu) */\n' +
'    const tg = kirmizi.taskGroups || (kirmizi.lastPlan && kirmizi.lastPlan.taskGroups);\n' +
'    if (tg && tg.length) for (const gr of tg) roller[gr.role] = (roller[gr.role] || 0) + 1;\n' +
'    const t = battleTaktikTespit(kirmizi);\n' +
'    if (!(t && t.taktik === "STANDOFF_ATIS")) continue;\n' +
'    orn++;\n' +
'    const kay = t.kanit.kaynak;\n' +
'    let dTop=0, dN=0, dMin=1e9, yakin=0, ySum=0;\n' +
'    for (const u of SIM.units) {\n' +
'      if (u.dead || u.loaded || u.abandoned || !u.isRed) continue;\n' +
'      const s = STATS[u.type];\n' +
'      if (!s || !s.weapons || !s.weapons.length) continue;\n' +
'      const d = Math.hypot(kay.x - u.x, kay.y - u.y);\n' +
'      dTop += d; dN++; if (d < dMin) dMin = d; if (d < 800) yakin++; ySum += u.y;\n' +
'    }\n' +
'    if (dN) { mTop += dTop/dN; minTop += dMin; yakinTop += yakin; yTop += ySum/dN; kayYTop += kay.y; }\n' +
'  }\n' +
'  const cls = kirmizi.perception && kirmizi.perception._threatProfile && kirmizi.perception._threatProfile.classes;\n' +
'  const aa = cls && cls.areaAlpha;\n' +
'  const rt = (aa && aa.reactionsTriggered) ? aa.reactionsTriggered.slice() : [];\n' +
'  return JSON.stringify({ orn: orn,\n' +
'    mesafe: orn ? mTop/orn : null, minMesafe: orn ? minTop/orn : null,\n' +
'    yakin: orn ? yakinTop/orn : null, kirmiziY: orn ? yTop/orn : null,\n' +
'    kaynakY: orn ? kayYTop/orn : null,\n' +
'    tepkiler: rt, roller: roller, tel: BATTLE_KP_TELEMETRI });\n' +
'})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'kpa-' + seed + '-' + karsiPlan + '.js' }));
}

console.log('');
console.log('KARSI-PLAN ATIF PROBU   ' + MAC + ' tohum   kapsam=' + KAPSAM);
console.log('');
const f = (x) => x == null ? '   —' : String(Math.round(x)).padStart(5);
const d = [];
for (let i = 0; i < MAC; i++) {
    const seed = TOHUM0 + i;
    const k = kos(seed, false), a = kos(seed, true);
    d.push({ k: k, a: a });
    console.log('  tohum ' + seed);
    console.log('     ortMesafe ' + f(k.mesafe) + ' -> ' + f(a.mesafe) +
        '   minMesafe ' + f(k.minMesafe) + ' -> ' + f(a.minMesafe) +
        '   yakin(<800px) ' + f(k.yakin) + ' -> ' + f(a.yakin));
    console.log('     kirmiziY  ' + f(k.kirmiziY) + ' -> ' + f(a.kirmiziY) +
        '   kaynakY  ' + f(k.kaynakY) + ' -> ' + f(a.kaynakY));
    console.log('     tepkiler(acik): [' + a.tepkiler.join(', ') + ']');
    console.log('     telemetri(acik): sorgu=' + a.tel.sorgu + '  aktif=' + a.tel.aktif +
        '  nisanUygulandi=' + a.tel.nisan + '  BASKIN=' + (a.tel.baskin | 0));
    console.log('        dal: cagri=' + (a.tel.cagri | 0) + '  engel[varildi]=' + (a.tel.engelVarildi | 0) +
        '  engel[yenile]=' + (a.tel.engelYenile | 0) + '  kilitli=' + (a.tel.kilitli | 0));
    for (const o of (a.tel.ornek || []).slice(0, 3)) console.log('        tik ' + o.tik + '  rol ' + o.rol + '  (' + o.eski.x + ',' + o.eski.y + ') -> (' + o.yeni.x + ',' + o.yeni.y + ')');
}
const derin = d.filter((x) => x.a.tepkiler.indexOf('karsiPlanDerinNisan') >= 0).length;
console.log('');
console.log('  DERIN NISAN UYGULANDI MI: ' + derin + '/' + d.length + ' mac');
if (!derin) {
    console.log('  ⛔ HIC UYGULANMADI. Yani olculen tum davranis farki KONSANTRASYON');
    console.log('     degisikliginden geliyor; derin nisan olu kod. FLANK grubu olusmuyor');
    console.log('     ya da planningContractDestination o rol icin cagrilmiyor olabilir.');
}
