// FAZ 0.2 — "SALDIRANDA ANTI-BLOB KORUMASI KAPALI MI?"
//
// js/BattleExecution.js:981-993 `focusForContract`:
//   sektor odagi varsa onu dondurur; YOKSA anti-blob dali devreye girer AMA yalniz
//   `ctrl.lastSituation.role === DEFENDER` iken. SALDIRAN grup global ORTAK odaga duser
//   -> tum gruplar tek dusmana yigilir -> blob.
//
// Bu arac motora DOKUNMADAN ayni kurali disaridan uygular ve sayar: her tik, her muharip
// sozlesme icin "sektor odagi buldu mu, yoksa global odaga mi dustu".
// Kod-AI ve ENJEKTE plan (beonai/oracle yolu) ayri ayri olculur.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const _si = process.argv.indexOf('--seeds');
const TOHUMLAR = _si >= 0 ? process.argv[_si + 1].split(',').map(Number) : [2024, 3141, 777, 11];
const SURUM = arg('--surum', 'beonai-karisim');

const { ctx } = tezgahKur();

function kos(surum, seed, kirmiziSaldiran) {
    const kod = [
        '(() => {',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;',
        'BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'BATTLE_BEONAI_RED = ' + (surum ? JSON.stringify(surum) : 'null') + '; BATTLE_BEONAI_BLUE = null;',
        'BATTLE_RECIPE_RED = null;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ' }), false, { source:"od", ally:true });',
        'startBattle();',
        'const say = { sektor: 0, global: 0, sektorsuz: 0, rol: {}, enjekte: 0, kodPlan: 0 };',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '  if (SIM.tick % 20) continue;',
        '  const c = [...BATTLE_CONTROLLERS.values()].find(x => x.side === true);',
        '  if (!c || !c.taskExecutor || !c.operationalPlan) continue;',
        '  const p = c.operationalPlan;',
        '  if (p.injected) say.enjekte++; else say.kodPlan++;',
        '  const fbs = c.taskExecutor.focusBySector;',
        // focusForContract kuralinin DISARIDAN uygulanmasi (motor degistirilmedi)
        '  for (const ct of (p.taskContracts || [])) {',
        '    if (!ct.groupRole || ct.groupRole === "SUPPORT" || ct.groupRole === "RECON") continue;',
        '    const r = ct.groupRole;',
        '    say.rol[r] = say.rol[r] || { sektor: 0, global: 0, sektorsuz: 0 };',
        '    if (!ct.sector) { say.sektorsuz++; say.rol[r].sektorsuz++; continue; }',
        '    const f = fbs ? fbs[ct.sector] : null;',
        '    if (f != null) { say.sektor++; say.rol[r].sektor++; }',
        '    else { say.global++; say.rol[r].global++; }',
        '  }',
        '} } finally { SIM.headless = ph; }',
        'BATTLE_BEONAI_RED = null;',
        'return JSON.stringify(say);',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'od.js' }));
}

console.log('FAZ 0.2 — ODAK TESHISI   (KIRMIZI kontrolor; "global" = grup ortak yigina dustu)');
console.log('  surum: ' + SURUM + '   taban: kod-AI');
console.log('');
for (const rol of [true, false]) {
    console.log('  ── KIRMIZI ' + (rol ? 'SALDIRAN' : 'SAVUNAN') + ' ──');
    console.log('  ' + 'kol'.padEnd(18) + 'sektor-odagi'.padStart(14) + 'GLOBAL yigin'.padStart(14) +
        'sektorsuz'.padStart(12) + '   GLOBAL orani');
    for (const [ad, sur] of [['kod-AI', null], [SURUM, SURUM]]) {
        const T = { sektor: 0, global: 0, sektorsuz: 0, rol: {} };
        for (const seed of TOHUMLAR) {
            const r = kos(sur, seed, rol);
            T.sektor += r.sektor; T.global += r.global; T.sektorsuz += r.sektorsuz;
            for (const k in r.rol) { T.rol[k] = T.rol[k] || { sektor: 0, global: 0, sektorsuz: 0 };
                for (const f of ['sektor', 'global', 'sektorsuz']) T.rol[k][f] += r.rol[k][f]; }
        }
        const top = T.sektor + T.global + T.sektorsuz;
        console.log('  ' + ad.padEnd(18) + String(T.sektor).padStart(14) + String(T.global).padStart(14) +
            String(T.sektorsuz).padStart(12) + ('   %' + Math.round((T.global + T.sektorsuz) / Math.max(1, top) * 100)).padStart(15));
        for (const k of Object.keys(T.rol).sort()) {
            const x = T.rol[k], t2 = x.sektor + x.global + x.sektorsuz;
            console.log('      ' + k.padEnd(14) + String(x.sektor).padStart(14) + String(x.global).padStart(14) +
                String(x.sektorsuz).padStart(12) + ('   %' + Math.round((x.global + x.sektorsuz) / Math.max(1, t2) * 100)).padStart(15));
        }
    }
    console.log('');
}
console.log('  OKUMA: GLOBAL orani yuksekse gruplar tek hedefe yigiliyor demektir. Anti-blob dali');
console.log('         (BattleExecution.js:989) yalniz SAVUNAN icin acik — saldirandaki fark buradan gelir.');
