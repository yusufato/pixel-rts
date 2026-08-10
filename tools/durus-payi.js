// DURUS PAYI — iki beyin macin yuzde kacini hangi operasyonel duruste geciriyor?
//
// GORSEL IZLEMEDEN CIKAN HIPOTEZ (--izle, iki mac): pro saldirirken POSITION'da, savunurken PRESERVE'de
// takiliyor; intel4 ise erken STRIKE'a gecip orada kaliyor. Ekranda gorulen sey buydu:
//   pro SALDIRAN : SHAPE -> POSITION -> (gec) STRIKE, 21 birim -> 3
//   pro SAVUNAN  : PRESERVE (mac boyu), 24 birim -> 1, "defender_eliminated"
//   intel4       : SHAPE -> STRIKE (24. saniye) ve orada kalir
// GORULEN SEY OLCULMEZSE IDDIA OLMAZ: bu arac duruslarin ZAMAN PAYINI sayar ve sonucla eslestirir.
//
// Kullanim: node tools/durus-payi.js [--tohum 6] [--atla 0]
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
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ', pro:' + (!proKirmizi) + ' }), false, { source:"dp", ally:true });',
        'startBattle();',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'const pay = {};',   // controllerId -> { stance -> tik }  (TUM mac)
        'const payErken = {};',   // yalniz ilk 60 sn (1200 tik) — ters-nedensellik kontrolu
        'let tik = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '  tik++;',
        '  const P = SIM.ctrlPosture || {};',
        '  for (const id of Object.keys(P)) {',
        '    const st2 = P[id] && P[id].stance ? P[id].stance : "-";',
        '    const rol = P[id] && P[id].role ? P[id].role : "-";',
        '    const k = id + "|" + rol;',
        '    (pay[k] || (pay[k] = {}))[st2] = ((pay[k] || {})[st2] || 0) + 1;',
        '    if (SIM.tick <= 1200) (payErken[k] || (payErken[k] = {}))[st2] = ((payErken[k] || {})[st2] || 0) + 1;',
        '  }',
        '} } finally { SIM.headless = ph; }',
        'const oK = battleArmyObservation(true), oM = battleArmyObservation(false);',
        'const b = SIM.battle || {};',
        // controllerId -> taraf esleme: birimlerden turet
        'const tarafOf = {};',
        'for (const u of SIM.units) if (u.controllerId) tarafOf[u.controllerId] = !!u.isRed;',
        'return JSON.stringify({ tik: tik, pay: pay, payErken: payErken, tarafOf: tarafOf,',
        '  marj: Math.round(oK.effectiveValue - oM.effectiveValue),',
        '  kazanan: b.winnerSide === true ? "kirmizi" : (b.winnerSide === false ? "mavi" : "berabere") });',
        '})()'
    ].join('\n');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'dp.js' }));
}

// Kontrolor kimlikleri sabit: battle-red-ai / battle-blue-ally-ai. Taraf esleme buradan yapilir.
const KIRMIZI_ID = 'battle-red-ai';
const topla = { pro: {}, intel4: {} };
const rolPay = { 'pro|attacker': {}, 'pro|defender': {}, 'intel4|attacker': {}, 'intel4|defender': {} };
const rolPayErken = { 'pro|attacker': {}, 'pro|defender': {}, 'intel4|attacker': {}, 'intel4|defender': {} };
let mac = 0, proGalip = 0;

console.log('DURUS PAYI — ' + TOHUMLAR.length + ' tohum x 2 rol x 2 taraf = ' + (TOHUMLAR.length * 4) + ' mac');
for (const s of TOHUMLAR) for (const kirmiziSaldiran of [true, false]) for (const proK of [true, false]) {
    const r = kos(s, kirmiziSaldiran, proK);
    mac++;
    if ((proK && r.kazanan === 'kirmizi') || (!proK && r.kazanan === 'mavi')) proGalip++;
    for (const anahtar of Object.keys(r.pay)) {
        const [id, rol] = anahtar.split('|');
        const kirmizi = (id === KIRMIZI_ID) ? true : (r.tarafOf[id] === undefined ? null : r.tarafOf[id]);
        if (kirmizi === null) continue;
        const beyin = (kirmizi === proK) ? 'pro' : 'intel4';
        const rk = beyin + '|' + rol;
        for (const st of Object.keys(r.pay[anahtar])) {
            topla[beyin][st] = (topla[beyin][st] || 0) + r.pay[anahtar][st];
            if (rolPay[rk]) rolPay[rk][st] = (rolPay[rk][st] || 0) + r.pay[anahtar][st];
        }
        const e = (r.payErken || {})[anahtar] || {};
        for (const st of Object.keys(e)) if (rolPayErken[rk]) rolPayErken[rk][st] = (rolPayErken[rk][st] || 0) + e[st];
    }
    if (mac % 8 === 0) { try { fs.writeSync(1, '    ...' + mac + '/' + (TOHUMLAR.length * 4) + '\n'); } catch (e) {} }
}

const DURUSLAR = ['SHAPE', 'POSITION', 'STRIKE', 'CONSOLIDATE', 'PRESERVE', '-'];
function satir(ad, m) {
    const tot = Object.values(m).reduce((a, b) => a + b, 0) || 1;
    const hucre = DURUSLAR.map(d => String(Math.round((m[d] || 0) / tot * 100)).padStart(5) + '%');
    console.log('  ' + ad.padEnd(20) + hucre.join(''));
}
console.log('');
console.log('  ══ pro ' + proGalip + '/' + mac + ' = %' + Math.round(proGalip / mac * 100) + ' ══');
console.log('');
console.log('  ' + ''.padEnd(20) + DURUSLAR.map(d => d.slice(0, 5).padStart(6)).join(''));
satir('pro TOPLAM', topla.pro);
satir('intel4 TOPLAM', topla.intel4);
console.log('');
for (const k of Object.keys(rolPay)) satir(k, rolPay[k]);
console.log('');
console.log('  ── ILK 60 SANIYE (iki ordu da hemen hemen tam guclu; ters-nedensellik kontrolu) ──');
for (const k of Object.keys(rolPayErken)) satir(k + ' <60sn', rolPayErken[k]);
try { fs.mkdirSync('qa-runtime', { recursive: true }); } catch (e) {}
fs.writeFileSync('qa-runtime/durus-payi.json', JSON.stringify({ mac, proGalip, topla, rolPay, rolPayErken }, null, 2), 'utf8');
console.log('\n  -> qa-runtime/durus-payi.json');
