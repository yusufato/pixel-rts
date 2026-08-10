// HEDEF CALKANTISI ATFI — birimin targetX'ini SAATTE 6.4 KEZ kim degistiriyor?
//
// OLCULDU (tools/karar-dongusu.js, 24 mac): her birim dakikada ~6.4 kez 220px+ hedef degistiriyor ve
// net yer degistirmesinin ~4 KATI yol yuruyor. Iki beyinde de ayni. Bu, temas anina kuvvetin yalnizca
// %12'sinin yetismesinin en olasi sebebi: birimler surekli yon degistirip yolda omur tuketiyor.
//
// TAHMIN YOK, ATIF: `targetX` bir setter'a sarilir ve HER 220px+ degisimde cagri yiginindan sorumlu
// fonksiyon adi cikarilir. Cikti: hangi kod yolu calkantinin yuzde kacini uretiyor.
// (Ayni teknik daha once titreme kok-nedenini bulmustu — bkz. pixel-rts-titreme-unstick.)
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 3)) || 3);
const HAVUZ = []; for (let i = 0; i < 96; i++) HAVUZ.push(100000 + i * 137);
const TOHUMLAR = HAVUZ.slice(0, N);
const NL = String.fromCharCode(10);

const { ctx } = tezgahKur();

function kos(seed, kirmiziSaldiran) {
    const kod = [
        '(() => {',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = false;',
        'BATTLE_INTEL4PRO_DELTAS_RED = { indirectMassing:false, assaultCohesion:false, counterBattery:false, standoff:false, heloHunt:false, spotterRequirement:false };',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ', pro:false }), false, { source:"hc", ally:true });',
        'startBattle();',
        'const sayac = {};',
        // targetX'i sarmala: 220px+ degisimde yigindan sorumlu cerceveyi bul
        'function sarmala(u) {',
        '  let _v = u.targetX;',
        '  Object.defineProperty(u, "targetX", {',
        '    get() { return _v; },',
        '    set(nv) {',
        '      if (Math.abs(nv - _v) > 220) {',
        '        const y = String(new Error().stack).split(String.fromCharCode(10));',
        '        let ad = "?";',
        '        for (let i = 2; i < y.length && i < 9; i++) {',
        '          const m = y[i].match(/at ([A-Za-z0-9_.$]+)/);',
        '          if (!m) continue;',
        '          const f = m[1];',
        '          if (f === "Object.set" || f === "set" || f.indexOf("sarmala") >= 0) continue;',
        '          ad = f; break;',
        '        }',
        '        sayac[ad] = (sayac[ad] || 0) + 1;',
        '      }',
        '      _v = nv;',
        '    }, configurable: true });',
        '}',
        'for (const u of SIM.units) if (u.isRed) sarmala(u);',   // yalniz KIRMIZI (pro) tarafi
        'const ph = SIM.headless; SIM.headless = true; let st = 0; let sarili = new Set(SIM.units.filter(u=>u.isRed).map(u=>u.id));',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '  for (const u of SIM.units) if (u.isRed && !sarili.has(u.id)) { sarmala(u); sarili.add(u.id); }',   // sonradan dogan (drone)
        '} } finally { SIM.headless = ph; }',
        'return JSON.stringify({ sayac: sayac, tik: SIM.tick });',
        '})()'
    ].join(NL);
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'hc.js' }));
}

const toplam = {};
let tik = 0;
console.log('HEDEF CALKANTISI ATFI — ' + TOHUMLAR.length + ' tohum x 2 rol (yalniz pro tarafi)');
for (const s of TOHUMLAR) for (const rol of [true, false]) {
    const r = kos(s, rol);
    for (const k of Object.keys(r.sayac)) toplam[k] = (toplam[k] || 0) + r.sayac[k];
    tik += r.tik;
}
const tum = Object.values(toplam).reduce((a, b) => a + b, 0) || 1;
console.log('');
console.log('  toplam 220px+ hedef degisimi: ' + tum);
console.log('  kaynak                                     adet     pay');
for (const k of Object.keys(toplam).sort((a, b) => toplam[b] - toplam[a]).slice(0, 14)) {
    console.log('  ' + k.padEnd(40) + String(toplam[k]).padStart(8) + String(Math.round(toplam[k] / tum * 100) + '%').padStart(8));
}
try { fs.mkdirSync('qa-runtime', { recursive: true }); } catch (e) {}
fs.writeFileSync('qa-runtime/hedef-calkanti.json', JSON.stringify(toplam, null, 2), 'utf8');
console.log('');
console.log('  -> qa-runtime/hedef-calkanti.json');
