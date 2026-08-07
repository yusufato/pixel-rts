// YETENEK KAPISI — "beonai INSANIN ordusuyla, INSANIN dizilisiyle kazanabiliyor mu?"
//
// KULLANICI FIKRI: "benim tarzimi oynayan ai benim birliklerim ve benim dizilisimle acilis
// yapacak ve tohum 202'de oynadigim rakibi YENENE KADAR savasacak. Ne zaman yenmeye baslarsa
// yetenegi artmistir — cunku benim ordum YETENEK ORDUSU."
//
// NEDEN GUCLU: kullanicinin ordusu 4 havan + 1 MLRS + 3 drone operatoru ve SIFIR zirhli.
// Yiginlanarak oynayan bir AI bu orduyla hicbir sey yapamaz — dolayli ates konumlandirma,
// gozcu kullanimi ve mesafe koruma ister. "Bu orduyu kullanabiliyor musun" sorusu dogrudan
// "beceri kazandin mi" sorusudur. Ustelik INSAN REFERANSI var (kullanici dordunu de kazandi):
//
//   vs intel3-pro -> kalan MAVI 14 / KIRMIZI 2   (312sn)
//   vs intel4     -> kalan MAVI 16 / KIRMIZI 1   (230sn)
//   vs intel4-pro -> kalan MAVI 12 / KIRMIZI 2   (211sn)
//   vs beonai     -> kalan MAVI 17 / KIRMIZI 2   (148sn)
//
// KURULUM: MAVI = insanin ordusu + insanin BASLANGIC KONUMLARI (ham replay'den),
// beyni secilebilir (kod-AI / beonai). KIRMIZI = secilen rakip AI. Tohum 202 sabit.
// Konumlandirma deterministik: tip-esleme ile kayitli koordinatlara tasima (RNG yok).
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const RAKIP = arg('--rakip', 'intel4-pro');            // intel3-pro | intel4 | intel4-pro
const MAVI_BEYIN = arg('--mavi', 'kod-AI');            // kod-AI | <beonai surumu>
const SEED = Number(arg('--seed', 202));
const DIZILIS = arg('--dizilis', 'qa-runtime/insan-dizilis-202.json');

const kayit = JSON.parse(fs.readFileSync(DIZILIS, 'utf8'));
const DIZ = kayit._dizilis || [];
const REFERANS = {};
for (const k of ['intel3-pro', 'intel4', 'intel4-pro', 'beonai']) if (kayit[k]) REFERANS[k] = kayit[k];

// Insanin tohum 202'deki bilesimi (ham telemetriden okundu)
const INSAN_TARIF = { ad: 'INSAN-202', rol: 'defender', tavan: {}, artik: [],
    zorunlu: { mortar_team: 4, mlrs: 1, drone_operator: 3, recon_uav: 2, scout_vehicle: 1,
               infantry: 4, commando: 2, tank_destroyer: 2, spaag: 1, attack_helo: 1,
               ew_vehicle: 1, engineer: 1, supply_truck: 1 } };

const RAKIP_BAYRAK = {
    'intel3-pro': { i4: false, pro: false },
    'intel4':     { i4: true,  pro: false },
    'intel4-pro': { i4: true,  pro: true },
};

const { ctx } = tezgahKur();

function kos(maviBeyin, rakip) {
    const rb = RAKIP_BAYRAK[rakip] || RAKIP_BAYRAK['intel4-pro'];
    const beonai = (maviBeyin && maviBeyin !== 'kod-AI') ? maviBeyin : null;
    const kod = [
        '(() => {',
        // KIRMIZI = rakip AI (canli maçtaki gibi saldiran), MAVI = insanin ordusu
        'BATTLE_INTEL4_RED = ' + rb.i4 + '; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;',
        'BATTLE_INTEL4PRO_RED = ' + rb.pro + '; BATTLE_INTEL4PRO_BLUE = false;',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'BATTLE_BEONAI_RED = null; BATTLE_BEONAI_BLUE = ' + (beonai ? JSON.stringify(beonai) : 'null') + ';',
        'BATTLE_RECIPE_RED = null; BATTLE_RECIPE_BLUE = null;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + SEED + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false, recipe: ' + JSON.stringify(INSAN_TARIF) + ' }), false, { source:"yk", ally:true });',
        'startBattle();',
        // ── INSANIN DIZILISI: tip-esleme ile kayitli koordinatlara tasi (determinist) ──
        'const _diz = ' + JSON.stringify(DIZ) + ';',
        'const _havuz = {};',
        'for (const p of _diz) { (_havuz[p.type] = _havuz[p.type] || []).push(p); }',
        'let _yerlesen = 0, _yerlesmeyen = 0;',
        'for (const u of SIM.units.filter(z => !z.isRed).sort((a, b) => a.id - b.id)) {',
        '  const h = _havuz[u.type];',
        '  if (h && h.length) { const p = h.shift(); u.x = p.x; u.y = p.y;',
        '    u.targetX = p.x; u.targetY = p.y; u.manualMoveTarget = null; u.isMovingToManualTarget = false; _yerlesen++; }',
        '  else _yerlesmeyen++;',
        '}',
        'const _yay = { m: 0, k: 0, bm: 0, n: 0 };',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '  if (SIM.tick % 100) continue;',
        '  for (const [tf, kk] of [["m", false], ["k", true]]) {',
        '    const a = SIM.units.filter(u => !u.dead && !u.loaded && !!u.isRed === kk);',
        '    if (a.length < 2) continue;',
        '    let t = 0, c = 0;',
        '    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) { t += Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y); c++; }',
        '    _yay[tf] += c ? t / c : 0;',
        '    if (!kk) _yay.bm += a.reduce((x, u) => x + (u.suppression || 0), 0) / a.length;',
        '  }',
        '  _yay.n++;',
        '} } finally { SIM.headless = ph; }',
        'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);',
        'const b = SIM.battle || {};',
        'BATTLE_BEONAI_BLUE = null;',
        'const kalanM = SIM.units.filter(u => !u.dead && !u.isRed).length;',
        'const kalanK = SIM.units.filter(u => !u.dead && u.isRed).length;',
        'return JSON.stringify({ kalanMavi: kalanM, kalanKirmizi: kalanK,',
        '  sure: Math.round(SIM.tick * 0.05), yerlesen: _yerlesen, yerlesmeyen: _yerlesmeyen,',
        '  maviMarj: Math.round(oD.effectiveValue - oS.effectiveValue),',
        '  kazanan: b.winnerSide === false ? "MAVI" : (b.winnerSide === true ? "KIRMIZI" : "-"),',
        '  maviYayilim: _yay.n ? Math.round(_yay.m / _yay.n) : 0,',
        '  maviBaski: _yay.n ? +(_yay.bm / _yay.n).toFixed(1) : 0 });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'yk.js' }));
}

const maviler = MAVI_BEYIN.split(',').filter(Boolean);
console.log('YETENEK KAPISI — insanin ordusu + insanin dizilisi, tohum ' + SEED + ', rakip: ' + RAKIP);
console.log('  MAVI ordu: 4 havan + 1 MLRS + 3 drone operatoru, SIFIR zirhli (beceri ordusu)');
const ref = REFERANS[RAKIP];
if (ref) console.log('  INSAN REFERANSI: kalan MAVI ' + ref.kalanMavi + ' / KIRMIZI ' + ref.kalanKirmizi + '  (' + ref.sure + 'sn)  -> INSAN KAZANDI');
console.log('');
console.log('  ' + 'MAVI beyin'.padEnd(20) + 'kalan M/K'.padStart(11) + 'sonuc'.padStart(9) +
    'maviMarj'.padStart(10) + 'yayilim'.padStart(9) + 'baski'.padStart(8) + '  dizilis'.padStart(12));
for (const mb of maviler) {
    const r = kos(mb, RAKIP);
    console.log('  ' + mb.padEnd(20) + (r.kalanMavi + '/' + r.kalanKirmizi).padStart(11) +
        r.kazanan.padStart(9) + String(r.maviMarj).padStart(10) +
        (r.maviYayilim + 'px').padStart(9) + String(r.maviBaski).padStart(8) +
        ('  ' + r.yerlesen + '/' + (r.yerlesen + r.yerlesmeyen)).padStart(12));
}
console.log('');
console.log('  OKUMA: "dizilis" sutunu kac birimin insanin konumuna yerlestigini gosterir (bind kaniti).');
console.log('         Hedef: insanin skoruna yaklasmak. Kazanmaya baslarsa beceri gercekten artmistir —');
console.log('         cunku bu ordu yiginlanmayla degil, dolayli-ates + gozcu disipliniyle kazanir.');
