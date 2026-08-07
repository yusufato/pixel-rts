// BIRIM ONCU/OLUM TESHISI — "bu birim neden erken oluyor ve neden mermisini kullanmadan oluyor?"
// Saglik taramasi (tools/birim-sagligi.js) IFV'yi isaretledi: omur 57sn (ordunun en kisasi),
// %70'i TAM YUKLE oluyor, getiri x0.1. Ayni sorular scout_vehicle ve manpads_team icin de gecerli.
//
// LENS — "yerel ustunluk": daha once olculmustu (insan vs AI), kaybedilen saldirilarda kurbanin
// cevresinde ~3.4 dost / cok dusman vardi, kazanilanlarda ~10.8 dost. Yani erken olumun sebebi
// genelde MESAFE degil, YALNIZ YAKALANMAK. Bu arac tam olarak onu olcer:
//   (A) OLUM ANI   : kutle merkezine gore ISARETLI derinlik (+ = ONDE), en yakin dusman, yerel dost/dusman
//   (B) OMUR BOYU  : ayni buyukluklerin ortalamasi (olum ani mi istisna, yoksa surekli mi boyle)
//   (C) OLDUREN    : hangi tip, kac kez
//   (D) ATES        : kac atis yapabildi, hedefli gecen tik orani
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const { ctx } = tezgahKur();

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const BIRIM = arg('--birim', 'ifv');
const _si = process.argv.indexOf('--seeds');
const TOHUMLAR = _si >= 0 ? process.argv[_si + 1].split(',').map(Number) : [2024, 3141, 777, 11, 202, 333];
const YEREL_R = Number(arg('--yerelr', 600));   // yerel ustunluk yaricapi (onceki olcumle ayni)

const kod = [
    '(() => {',
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
    'const cikti = [];',
    'for (const seed of ' + JSON.stringify(TOHUMLAR) + ') {',
    '  BATTLE_RECIPE_RED = null;',   // AI kendi ordusunu kursun (birim zaten dogal orduda var)
    '  openBattlefieldSession({ mode:"quick", mapId:-2, seed, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    '  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"oc", ally:true });',
    '  startBattle();',
    '  const BT = Object.keys(STATS).map(Number).find(t => STATS[t] && STATS[t].id === "' + BIRIM + '");',
    '  const izle = new Map();',
    '  for (const u of SIM.units) if (u.type === BT && u.isRed) izle.set(u.id, {',
    '    oldu: null, atis: 0, sonAtisT: u.lastAttackTime || 0, hedefli: 0, canli: 0,',
    '    ondeTop: 0, dusmanTop: 0, dostTop: 0, dusmanYakinTop: 0, n: 0,',
    '    olumOnde: null, olumDusman: null, olumDost: null, olumDusmanY: null, olumAmmo: null, maxAmmo: u.maxAmmo || 0 });',
    '  const k = { seed, kadro: izle.size, oldu: 0, olduren: {}, det: [] };',
    '  let sonSeq = -1;',
    '  const ph = SIM.headless; SIM.headless = true; let st = 0;',
    '  try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
    '    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
    '    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
    // dost kutle merkezi (deger agirlikli)
    '    let cx = 0, cy = 0, cn = 0;',
    '    for (const u of SIM.units) { if (u.dead || u.loaded || !u.isRed) continue;',
    '      const v = (STATS[u.type] && STATS[u.type].cost) || 0; cx += u.x*v; cy += u.y*v; cn += v; }',
    '    const gx = cn ? cx/cn : 0, gy = cn ? cy/cn : 0;',
    '    for (const u of SIM.units) {',
    '      const r = izle.get(u.id); if (!r) continue;',
    '      if (u.dead) { if (r.oldu === null) { r.oldu = SIM.tick; k.oldu++; } continue; }',
    '      r.canli++;',
    '      if ((u.lastAttackTime||0) !== r.sonAtisT) { r.sonAtisT = u.lastAttackTime||0; r.atis++; }',
    '      if (u.attackTarget && !u.attackTarget.dead) r.hedefli++;',
    '      if (SIM.tick % 10 === 0) {',
    '        let dost = 0, dusman = 0, enD = 1e9;',
    '        for (const o of SIM.units) { if (o.dead || o.loaded || o === u) continue;',
    '          const d = Math.hypot(o.x-u.x, o.y-u.y);',
    '          if (o.isRed === u.isRed) { if (d <= ' + YEREL_R + ') dost++; }',
    '          else { if (d <= ' + YEREL_R + ') dusman++; if (d < enD) enD = d; } }',
    '        r.ondeTop += (u.y - gy); r.dostTop += dost; r.dusmanTop += dusman;',
    '        r.dusmanYakinTop += (enD < 1e8 ? enD : 0); r.n++;',
    '        r.olumOnde = Math.round(u.y - gy); r.olumDost = dost; r.olumDusman = dusman;',
    '        r.olumDusmanY = Math.round(enD < 1e8 ? enD : -1); r.olumAmmo = u.ammo;',
    '      }',
    '    }',
    '    if (typeof BATTLE_FORENSIC !== "undefined" && BATTLE_FORENSIC.buf) {',
    '      for (const ev of BATTLE_FORENSIC.buf) { if (ev.seq <= sonSeq) continue; sonSeq = ev.seq;',
    '        if (ev.lethal && ev.targetType === BT && ev.targetSide === "red") {',
    '          const ad = (STATS[ev.attackerType]||{}).id || "?"; k.olduren[ad] = (k.olduren[ad]||0)+1; } }',
    '    }',
    '  } } finally { SIM.headless = ph; }',
    '  for (const [, r] of izle) k.det.push({',
    '    omurSn: Math.round((r.oldu != null ? r.oldu : SIM.tick) * 0.05), oldu: r.oldu != null,',
    '    atis: r.atis, hedefliPct: r.canli ? Math.round(r.hedefli/r.canli*100) : 0,',
    '    ortOnde: r.n ? Math.round(r.ondeTop/r.n) : 0, ortDost: r.n ? +(r.dostTop/r.n).toFixed(1) : 0,',
    '    ortDusman: r.n ? +(r.dusmanTop/r.n).toFixed(1) : 0,',
    '    ortDusmanY: r.n ? Math.round(r.dusmanYakinTop/r.n) : 0,',
    '    olumOnde: r.olumOnde, olumDost: r.olumDost, olumDusman: r.olumDusman,',
    '    olumDusmanY: r.olumDusmanY, olumAmmo: r.olumAmmo, maxAmmo: r.maxAmmo });',
    '  BATTLE_RECIPE_RED = null;',
    '  cikti.push(k);',
    '}',
    'return JSON.stringify(cikti);',
    '})()'
].join('');

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'oc.js' }));
console.log('ONCU/OLUM TESHISI — birim: ' + BIRIM + ', ' + r.length + ' tohum, AI dogal ordusu, yerel yaricap ' + YEREL_R + 'px');
console.log('');
const T = { n: 0, oldu: 0, omur: 0, atis: 0, hed: 0, onde: 0, dost: 0, dusman: 0, dY: 0,
    oOnde: 0, oDost: 0, oDusman: 0, oDY: 0, oN: 0, tamYuk: 0, ammoli: 0 };
const O = {};
for (const x of r) {
    for (const a in x.olduren) O[a] = (O[a] || 0) + x.olduren[a];
    for (const d of x.det) {
        T.n++; T.omur += d.omurSn; T.atis += d.atis; T.hed += d.hedefliPct;
        T.onde += d.ortOnde; T.dost += d.ortDost; T.dusman += d.ortDusman; T.dY += d.ortDusmanY;
        if (d.oldu) { T.oldu++; T.oOnde += (d.olumOnde || 0); T.oDost += (d.olumDost || 0);
            T.oDusman += (d.olumDusman || 0); T.oDY += (d.olumDusmanY || 0); T.oN++;
            if (d.maxAmmo > 0) { T.ammoli++; if (d.olumAmmo >= d.maxAmmo * 0.9) T.tamYuk++; } }
    }
}
const p = (a, b) => (b ? (a / b) : 0);
console.log('  kadro ' + T.n + '   olen ' + T.oldu + '   ort. omur ' + p(T.omur, T.n).toFixed(0) + 'sn' +
    '   ort. atis ' + p(T.atis, T.n).toFixed(1) + '   hedefli %' + p(T.hed, T.n).toFixed(0));
console.log('');
console.log('  (B) OMUR BOYU ortalama:');
console.log('      kutle merkezine gore : ' + (p(T.onde, T.n) > 0 ? '+' : '') + p(T.onde, T.n).toFixed(0) + 'px   (+ = dusmana dogru ONDE)');
console.log('      yerel dost / dusman  : ' + p(T.dost, T.n).toFixed(1) + ' / ' + p(T.dusman, T.n).toFixed(1) +
    '   oran ' + (p(T.dusman, T.n) ? (p(T.dost, T.n) / p(T.dusman, T.n)).toFixed(1) : '-'));
console.log('      en yakin dusman      : ' + p(T.dY, T.n).toFixed(0) + 'px');
console.log('');
console.log('  (A) OLUM ANI (olen ' + T.oN + ' birim):');
console.log('      kutle merkezine gore : ' + (p(T.oOnde, T.oN) > 0 ? '+' : '') + p(T.oOnde, T.oN).toFixed(0) + 'px');
console.log('      yerel dost / dusman  : ' + p(T.oDost, T.oN).toFixed(1) + ' / ' + p(T.oDusman, T.oN).toFixed(1) +
    '   oran ' + (p(T.oDusman, T.oN) ? (p(T.oDost, T.oN) / p(T.oDusman, T.oN)).toFixed(1) : '-'));
console.log('      en yakin dusman      : ' + p(T.oDY, T.oN).toFixed(0) + 'px');
if (T.ammoli) console.log('      TAM YUKLE olen       : ' + T.tamYuk + '/' + T.ammoli);
console.log('');
console.log('  (C) OLDUREN : ' + (Object.keys(O).length ? Object.entries(O).sort((a, b) => b[1] - a[1]).map(([a, n]) => a + ' ' + n).join(', ') : 'olmedi'));
