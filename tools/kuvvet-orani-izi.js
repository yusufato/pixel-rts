// KUVVET-ORANI IZI — pro'nun savunani neden mac boyu PRESERVE'de?
//
// ZINCIR HIPOTEZI (durus-payi + gorsel izlemeden): BattleSituation.js:184
//     losing = !saldiran && forceRatio < 0.6  -> gate ZORLA KAPALI -> PRESERVE
// Pro'da forceRatio'nun PAYDASI farkli hesaplaniyor (BattlePerception.js:131 'trueForceRatio':
// istihbarat tabani = DUSMANIN ILAN EDILMIS BUTCESI; intel4'te = KENDI baslangic degerim).
// Eger pro'nun paydasi sistematik olarak BUYUKSE, pro'nun orani daha dusuk cikar, 0.6 esigini
// daha erken/daha sik gecer ve savunan surekli PRESERVE'de kalir.
//
// OLCUM: her tik iki tarafin observation'indan forceRatio + istihbarat tabani cekilir.
// TUZAK NOTU: bu bir DOGRULAMA olcumudur; "pro daha pasif" bulgusunun SEBEBI mi yoksa
// SONUCU mu oldugunu ayirmak icin ilk 60 saniye ayri raporlanir (o pencerede kayip azdir).
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 4)) || 4);
const HAVUZ = []; for (let i = 0; i < 96; i++) HAVUZ.push(100000 + i * 137);
const TOHUMLAR = HAVUZ.slice(0, N);

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
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ', pro:' + (!proKirmizi) + ' }), false, { source:"ki", ally:true });',
        'startBattle();',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'const iz = { true: [], false: [] };',
        'const taban = {};',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '  if (SIM.tick % 20) continue;',
        '  for (const c of BATTLE_CONTROLLERS.values()) {',
        '    const s = c && c.lastSituation; const ob = c && c.lastObservation; if (!s || !ob) continue;',
        '    const k = c.side ? "true" : "false";',
        '    if (taban[k] === undefined && c.perception) taban[k] = Math.round(c.perception.initialFriendlyValue || 0);',
        '    iz[k].push({ sn: Math.round(SIM.tick*0.05), oran: s.forceRatio,',
        '      dostDeger: Math.round(ob.friendlyValue || 0),',
        '      dusTahmin: Math.round(ob.estimatedEnemyValue || 0) });',
        '  }',
        '} } finally { SIM.headless = ph; }',
        'const b = SIM.battle || {};',
        'return JSON.stringify({ iz: iz, taban: taban,',
        '  kazanan: b.winnerSide === true ? "kirmizi" : (b.winnerSide === false ? "mavi" : "berabere") });',
        '})()'
    ].join('\n');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'ki.js' }));
}

const kova = {
    'pro|attacker': [], 'pro|defender': [], 'intel4|attacker': [], 'intel4|defender': []
};
const tabanlar = { pro: [], intel4: [] };
let mac = 0;
console.log('KUVVET-ORANI IZI — ' + TOHUMLAR.length + ' tohum x 2 rol x 2 taraf');
for (const s of TOHUMLAR) for (const kirmiziSaldiran of [true, false]) for (const proK of [true, false]) {
    const r = kos(s, kirmiziSaldiran, proK); mac++;
    for (const k of ['true', 'false']) {
        const kirmizi = k === 'true';
        const beyin = (kirmizi === proK) ? 'pro' : 'intel4';
        const rol = (kirmizi === kirmiziSaldiran) ? 'attacker' : 'defender';
        for (const o of r.iz[k]) kova[beyin + '|' + rol].push(o);
        if (r.taban[k] != null) tabanlar[beyin].push(r.taban[k]);
    }
}
const ort = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
console.log('');
console.log('  ' + 'kova'.padEnd(20) + '  n     oran(ort)  oran<0.6%   dostDeger  dusTahmin   | ILK 60 SN: oran  <0.6%');
for (const k of Object.keys(kova)) {
    const a = kova[k]; if (!a.length) { console.log('  ' + k.padEnd(20) + '  (veri yok)'); continue; }
    const gecerli = a.filter(x => Number.isFinite(x.oran));
    const alti = gecerli.filter(x => x.oran < 0.6).length;
    const e = gecerli.filter(x => x.sn <= 60);
    const eAlti = e.filter(x => x.oran < 0.6).length;
    console.log('  ' + k.padEnd(20) + String(gecerli.length).padStart(5) +
        String(ort(gecerli.map(x => x.oran)).toFixed(2)).padStart(11) +
        String(Math.round(alti / Math.max(1, gecerli.length) * 100) + '%').padStart(10) +
        String(Math.round(ort(gecerli.map(x => x.dostDeger)))).padStart(12) +
        String(Math.round(ort(gecerli.map(x => x.dusTahmin)))).padStart(11) +
        '   |        ' + String(ort(e.map(x => x.oran)).toFixed(2)).padStart(5) +
        String(Math.round(eAlti / Math.max(1, e.length) * 100) + '%').padStart(8));
}
console.log('');
console.log('  istihbarat tabani (initialFriendlyValue): pro ' + Math.round(ort(tabanlar.pro)) +
    '   intel4 ' + Math.round(ort(tabanlar.intel4)));
try { fs.mkdirSync('qa-runtime', { recursive: true }); } catch (e) {}
fs.writeFileSync('qa-runtime/kuvvet-orani-izi.json', JSON.stringify({ mac, kova, tabanlar }, null, 2), 'utf8');
console.log('  -> qa-runtime/kuvvet-orani-izi.json');
