// PROBE RAKIP — "INSAN GIBI" savunmaci. Canli coksuyu headless'ta TEKRAR URETMEK icin.
//
// NEDEN: FAZ 0 olctu ki beonai AI rakibe karsi sorunsuz (yayilim 823px, oz baski 3.7) ama
// INSANA karsi cokuyor (240px, 87.6). Fark rakibin TARZINDA. Kullanicinin 4 macindan olculen
// imza (tools/insan-imza.js):
//   yayilim 1027-1087px · hareket %5-18 · oz baski 0.6-3.0 · odak tepesi 1.9-2.7
// Yani: SABIT, YAYILI, siperli, atesi tek hedefe yigmayan sabirli savunma. Egitimdeki AI rakip
// ise hareket ediyor (%22-36) — beonai boyle bir rakibi HIC gormemis.
//
// UYGULAMA: motora DOKUNULMAZ. Probe tarafinin birimleri her tik yerinde sabitlenir
// (targetX/Y = mevcut konum, manuel hareket iptal). Ates ve savunma normal calisir — hareket
// katmani ayridir. Deterministik (RNG yok), fork/replay etkilenmez.
//
// OLCUT: beonai probe'a karsi COKUYOR mu (yayilim duser + oz baski firlar) ve kod-AI cokmuyor mu?
// Evet ise canli hata headless'ta yeniden uretilmis olur -> sebep kesinlesir, egitim dagilimina
// bu rakip eklenir.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 8)) || 8);
const SURUMLER = String(arg('--surum', 'beonai-karisim')).split(',').filter(Boolean);
const PROBE = !process.argv.includes('--probesiz');   // --probesiz: normal AI rakip (kontrol kolu)
// INSAN ORDUSU: kullanicinin tohum 202'de KURDUGU bilesim (ham telemetriden okundu).
// Duruşu taklit etmek YETMEDI (baski 4.3 -> 8.2, canli 42.4); asil fark ATES GUCU:
//   insan  : havan 4 + MLRS 1 = 5 alan-atesi birimi, 3 drone operatoru, 3 kesif, SIFIR zirhli
//   AI     : havan 2 + topcu 1 = 3 alan birimi, 1 operator, 2 kesif, 3 MBT + 2 IFV + 4 tanksavar
// Havan 200px aoe + 360px bastirma halkasi; dordu birden yiginlanmis orduyu civiler.
const INSAN_ORDU = !process.argv.includes('--aiordu');
const INSAN_TARIF = { ad: 'INSAN-202', rol: 'defender', tavan: {}, artik: [],
    zorunlu: { mortar_team: 4, mlrs: 1, drone_operator: 3, recon_uav: 2, scout_vehicle: 1,
               infantry: 4, commando: 2, tank_destroyer: 2, spaag: 1, attack_helo: 1,
               ew_vehicle: 1, engineer: 1, supply_truck: 1 } };

const HAVUZ = [202, 2024, 3141, 777, 11, 333, 4001, 4003, 4007, 4013, 4019, 4021];
const TOHUMLAR = HAVUZ.slice(0, N);

const { ctx } = tezgahKur();

function kos(surum, seed) {
    const kod = [
        '(() => {',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;',
        'BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'BATTLE_BEONAI_RED = ' + (surum ? JSON.stringify(surum) : 'null') + '; BATTLE_BEONAI_BLUE = null;',
        'BATTLE_RECIPE_RED = null;',
        'BATTLE_RECIPE_BLUE = null;',   // mavi ordu MANIFEST yolundan kurulur (asagida recipe parametresi)
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        // KIRMIZI SALDIRAN (canli maçtaki gibi: AI saldirir, insan savunur)
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false, recipe: ' + (INSAN_ORDU ? JSON.stringify(INSAN_TARIF) : 'null') + ' || undefined }), false, { source:"pr", ally:true });',
        'startBattle();',
        'const _maviKadro = {};',
        'for (const u of SIM.units) { if (u.isRed) continue; const id = (STATS[u.type]||{}).id || u.type; _maviKadro[id] = (_maviKadro[id]||0)+1; }',
        'const _yay = { k: 0, m: 0, bk: 0, bm: 0, hk: 0, n: 0 };',
        'const _olc = () => {',
        '  for (const [taraf, kirmizi] of [["k", true], ["m", false]]) {',
        '    const a = SIM.units.filter(u => !u.dead && !u.loaded && !!u.isRed === kirmizi);',
        '    if (a.length < 2) continue;',
        '    let t = 0, c = 0;',
        '    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {',
        '      t += Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y); c++; }',
        '    _yay[taraf] += c ? t / c : 0;',
        '    _yay["b" + taraf] += a.reduce((x, u) => x + (u.suppression || 0), 0) / a.length;',
        '    if (kirmizi) _yay.hk += a.filter(u => u.isMovingToManualTarget).length / a.length;',
        '  }',
        '  _yay.n++;',
        '};',
        // ── PROBE: MAVI tarafi her tik YERINDE sabitle (insan imzasi: hareket ~%0) ──
        'const _sabitle = () => {',
        '  for (const u of SIM.units) {',
        '    if (u.dead || u.isRed) continue;',
        '    u.targetX = u.x; u.targetY = u.y;',
        '    u.manualMoveTarget = null; u.isMovingToManualTarget = false;',
        '  }',
        '};',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        (PROBE ? '  _sabitle();' : '  // probe kapali (kontrol kolu)'),
        '  if (SIM.tick % 100 === 0) _olc();',
        '} } finally { SIM.headless = ph; }',
        'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);',
        'const b = SIM.battle || {};',
        'BATTLE_BEONAI_RED = null;',
        'return JSON.stringify({ marj: Math.round(oS.effectiveValue - oD.effectiveValue),',
        '  bitisTik: SIM.tick, kazanan: b.winnerSide === true ? 1 : (b.winnerSide === false ? 0 : -1),',
        '  kYayilim: _yay.n ? Math.round(_yay.k / _yay.n) : 0,',
        '  mYayilim: _yay.n ? Math.round(_yay.m / _yay.n) : 0,',
        '  kBaski: _yay.n ? +(_yay.bk / _yay.n).toFixed(1) : 0,',
        '  mBaski: _yay.n ? +(_yay.bm / _yay.n).toFixed(1) : 0,',
        '  kHareket: _yay.n ? +(_yay.hk / _yay.n * 100).toFixed(0) : 0, maviKadro: _maviKadro });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'pr.js' }));
}

console.log('PROBE RAKIP — ' + (PROBE ? 'INSAN IMZASI (sabit+yayili)' : 'KONTROL') + (INSAN_ORDU ? ' + INSAN ORDUSU' : ' + AI ordusu') +
    '   ' + TOHUMLAR.length + ' tohum, KIRMIZI saldiran');
console.log('  hedef: canli maçtaki cokusu (yayilim 240px, oz baski 87.6) headless\'ta yeniden uretmek');
console.log('');
console.log('  ' + 'kol'.padEnd(20) + 'KIRMIZI yayilim'.padStart(16) + 'KIRMIZI baski'.padStart(15) +
    'hareket%'.padStart(10) + 'MAVI yayilim'.padStart(14) + '  ort.marj'.padStart(11));
// BAGLANMA KANITI (tuzak B2): insan ordusu gercekten kuruldu mu?
{
    const _t = kos(null, TOHUMLAR[0]);
    const k = _t.maviKadro || {};
    const alan = ['mortar_team','mlrs','artillery','ballistic_missile'].reduce((s2,a)=>s2+(k[a]||0),0);
    console.log('  BAGLANMA KANITI — MAVI kadro: ' + Object.entries(k).sort((a,b)=>b[1]-a[1]).map(([a,n])=>a+' '+n).join(', '));
    console.log('    alan-atesi birimi: ' + alan + (INSAN_ORDU ? '   (insan ordusunda 5 olmali)' : ''));
    console.log('');
}
const sonuc = {};
for (const [ad, sur] of [['kod-AI (taban)', null]].concat(SURUMLER.map(s => [s, s]))) {
    const r = TOHUMLAR.map(seed => kos(sur, seed));
    sonuc[ad] = r;
    const o = (f) => r.reduce((a, x) => a + x[f], 0) / r.length;
    console.log('  ' + ad.padEnd(20) + (Math.round(o('kYayilim')) + 'px').padStart(16) +
        o('kBaski').toFixed(1).padStart(15) + ('%' + Math.round(o('kHareket'))).padStart(10) +
        (Math.round(o('mYayilim')) + 'px').padStart(14) + Math.round(o('marj')).toString().padStart(11));
}
console.log('');
const t = sonuc['kod-AI (taban)'];
for (const s of SURUMLER) {
    const m = sonuc[s];
    const f = m.map((x, i) => x.marj - t[i].marj);
    const ort = f.reduce((a, b) => a + b, 0) / f.length;
    const std = Math.sqrt(f.reduce((a, b) => a + (b - ort) * (b - ort), 0) / Math.max(1, f.length - 1));
    console.log('  ESLESTIRILMIS FARK ' + s + ': ' + (ort > 0 ? '+' : '') + Math.round(ort) +
        '   std.hata ' + Math.round(std / Math.sqrt(f.length)) +
        '   lehte ' + f.filter(x => x > 0).length + '/' + f.length);
}
console.log('');
console.log('  OKUMA: beonai KIRMIZI yayilimi tabana gore DUSUP baskisi FIRLIYORSA canli hata');
console.log('         headless\'ta yeniden uretilmistir -> sebep kesinlesir, rakip egitime eklenir.');
fs.writeFileSync(arg('--out', 'qa-runtime/probe-rakip.json'), JSON.stringify({ PROBE, TOHUMLAR, sonuc }, null, 1));
