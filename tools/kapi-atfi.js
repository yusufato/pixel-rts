// TAARRUZ-KAPISI ATFI — pro'nun savunani neden STRIKE'a gecemiyor? (tahmin yok, ATIF)
//
// IKI HIPOTEZ CURUTULDU (durustluk notu):
//   1. "pro'nun trueForceRatio'su paydayi buyutuyor" -> istihbarat tabani pro 6443 / intel4 6432 (AYNI),
//      delta ablasyonu t=-0.14. CURUK.
//   2. "pro farkli doktrinle sahaya cikiyor, STRIKE bias'i yuksek" -> agirlikli bias pro 0.041 /
//      intel4 0.030 (AYNI). CURUK.
// Bu arac tahmin uretmez: `computeOperationalPosture` SARMALANIR, her cagrinin GIRDILERI ve cikan
// durus kaydedilir; kapinin hangi alt-kosulda kaldigi tek tek sayilir.
//
// Kullanim: node tools/kapi-atfi.js [--tohum 4]
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
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ', pro:' + (!proKirmizi) + ' }), false, { source:"ka", ally:true });',
        'startBattle();',
        // ── SARMALAMA: her cagrinin girdisi + cikisi kaydedilir. Sim davranisi DEGISMEZ (ayni fonksiyon cagrilir).
        'const _asil = computeOperationalPosture;',
        'const kayit = [];',
        'computeOperationalPosture = function (o) {',
        '  const r = _asil(o);',
        '  const isAtt = o.role === BATTLE_ROLE.ATTACKER;',
        '  const th = (isAtt ? STRIKE_GATE.ATTACKER_BASE : STRIKE_GATE.DEFENDER_BASE)',
        '           - (isAtt ? STRIKE_GATE.ATTACKER_URGENCY_DROP : STRIKE_GATE.DEFENDER_URGENCY_DROP) * (o.timePressure || 0);',
        '  const eff = o.prevGateOpen ? th - STRIKE_GATE.HYSTERESIS : th;',
        '  kayit.push({',
        '    tik: o.now || 0, rol: isAtt ? "att" : "def", durus: r && r.stance, kapi: !!(r && r.strikeGateOpen),',
        '    temas: o.contactState === CONTACT_STATE.CONTACT,',
        '    oran: Number.isFinite(o.forceRatio) ? Math.round(o.forceRatio * 100) / 100 : null,',
        '    oranOK: Number.isFinite(o.forceRatio) && o.forceRatio >= eff,',
        '    bilgiOK: (o.contactConfidence || 0) >= STRIKE_GATE.MIN_CONFIDENCE,',
        '    muhOK: (o.ammoReadiness || 0) >= STRIKE_GATE.MIN_AMMO,',
        '    gorOK: isAtt || o.visibleRatio == null || (o.visibleRatio >= STRIKE_GATE.DEFENDER_VIS_MIN),',
        '    sok: !!o.shockWindow, sokUygun: !!o.shockWindow && (o.forceRatio >= 0.85),',
        '    kaybeden: !isAtt && Number.isFinite(o.forceRatio) && o.forceRatio < STRIKE_GATE.PRESERVE_RATIO,',
        '    taraf: null',
        '  });',
        '  return r;',
        '};',
        // hangi kaydin hangi tarafa ait oldugunu bilmek icin kontrolorleri SIRAYLA surelim: her tik once
        // kirmizi sonra mavi cagriliyor -> kayitlari tik+sira ile eslestirmek kirilgan. Bunun yerine
        // controller.side'i cagri aninda okuyabilmek icin kontrolorun analiz cagrisini sarmaliyoruz.
        'const _drive = battleControllersDrive;',
        'let _aktifTaraf = null;',
        'for (const c of BATTLE_CONTROLLERS.values()) {',
        '  const _u = c.update ? c.update.bind(c) : null;',
        '  if (!_u) continue;',
        '  c.update = function (now) { _aktifTaraf = c.side; const x = _u(now); _aktifTaraf = null; return x; };',
        '}',
        'const _push = kayit.push.bind(kayit);',
        'kayit.push = function (o) { o.taraf = _aktifTaraf; return _push(o); };',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, _drive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '} } finally { SIM.headless = ph; computeOperationalPosture = _asil; }',
        'return JSON.stringify({ kayit: kayit });',
        '})()'
    ].join('\n');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'ka.js' }));
}

const kova = { 'pro|def': [], 'intel4|def': [], 'pro|att': [], 'intel4|att': [] };
console.log('TAARRUZ-KAPISI ATFI — ' + TOHUMLAR.length + ' tohum x 2 rol x 2 taraf');
for (const s of TOHUMLAR) for (const kirmiziSaldiran of [true, false]) for (const proK of [true, false]) {
    const r = kos(s, kirmiziSaldiran, proK);
    for (const k of r.kayit) {
        if (k.taraf === null || k.taraf === undefined) continue;
        const beyin = (k.taraf === proK) ? 'pro' : 'intel4';
        const b = kova[beyin + '|' + k.rol];
        if (b) b.push(k);
    }
}
const yuzde = (a, f) => a.length ? Math.round(a.filter(f).length / a.length * 100) : 0;
console.log('');
console.log('  kova           n     STRIKE%  kapiAcik%  temas%  oranOK%  bilgiOK%  muhOK%  gorOK%  sok%  sokUygun%  kaybeden%');
for (const k of Object.keys(kova)) {
    const a = kova[k]; if (!a.length) { console.log('  ' + k.padEnd(14) + '(veri yok)'); continue; }
    const t = a.filter(x => x.temas);   // kapi zaten temas ister; alt-kosullari TEMASLI orneklerde say
    console.log('  ' + k.padEnd(14) + String(a.length).padStart(5) +
        String(yuzde(a, x => x.durus === 'STRIKE') + '%').padStart(11) +
        String(yuzde(a, x => x.kapi) + '%').padStart(10) +
        String(yuzde(a, x => x.temas) + '%').padStart(8) +
        String(yuzde(t, x => x.oranOK) + '%').padStart(9) +
        String(yuzde(t, x => x.bilgiOK) + '%').padStart(10) +
        String(yuzde(t, x => x.muhOK) + '%').padStart(8) +
        String(yuzde(t, x => x.gorOK) + '%').padStart(8) +
        String(yuzde(t, x => x.sok) + '%').padStart(6) +
        String(yuzde(t, x => x.sokUygun) + '%').padStart(11) +
        String(yuzde(t, x => x.kaybeden) + '%').padStart(11));
}
try { fs.mkdirSync('qa-runtime', { recursive: true }); } catch (e) {}
fs.writeFileSync('qa-runtime/kapi-atfi.json', JSON.stringify(
    Object.fromEntries(Object.entries(kova).map(([k, v]) => [k, v.length])), null, 2), 'utf8');
console.log('\n  (alt-kosul yuzdeleri YALNIZ temasli orneklerde; kapi temassiz zaten acilmaz)');
