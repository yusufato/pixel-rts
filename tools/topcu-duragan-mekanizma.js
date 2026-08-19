'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  TOPÇU ATEŞ DİSİPLİNİ — MEKANİZMA KAPISI
//
//  ÖLÇÜLEN KUSUR (kullanıcının 4 gerçek maçı, 2026-08-19): AI'nın dolaylı birimleri canlı
//  geçirdikleri zamanın **%42'sinde hareket halinde**; oyuncununkiler **%13**. Dolaylı ateş
//  yürürken atamaz ve sonuç tam da bu: birim başına isabet AI 23,0 · oyuncu 44,5 (1,9×).
//  Menzil sorunu DEĞİL — menzilde geçen zaman iki tarafta neredeyse aynı (%56 / %60).
//  Yükün kaynağı arama değil KONTROLÖR: dolaylı birim başına arama 6,1 emir, kontrolör 66,6.
//
//  Bu kapı `BATTLE_TOPCU_DURAGAN` kuralının o davranışı GERÇEKTEN değiştirip değiştirmediğini
//  ölçer — maç kapısına girmeden önce. Ölçülen şey gerçek maçlardakiyle AYNI büyüklük
//  (hareket payı + birim başına isabet), böylece tezgâh rakamı maç rakamıyla kıyaslanabilir.
//
//  ⚠ SONUÇ SÜTUNU DA BASILIR ama gücü DÜŞÜKTÜR (birkaç tohum, marj std ~2600). Yön gösterir,
//  hüküm vermez — hüküm maç kapısınındır. (Bu uyarı `menzile-gir-mekanizma.js`de eksikti ve
//  kural sonucu bozarken tertemiz bir "maç kapısına girebilir" damgası vermişti.)
//
//    node tools/topcu-duragan-mekanizma.js [--mac 6] [--tohum0 130000]
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 6)) || 6);
const TOHUM0 = Number(arg('--tohum0', 130000)) || 130000;
const ORNEK = Math.max(2, Number(arg('--ornek', 10)) || 10);   // kaç tikte bir konum örneği

const { ctx, hatalar } = tezgahKur();
if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }

function kos(seed, acik) {
    const kod = `(() => {
  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;
  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;
  if (typeof BATTLE_TOPCU_DURAGAN !== "undefined") BATTLE_TOPCU_DURAGAN = ${acik};
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;
  openBattlefieldSession({ mode:"quick", mapId:-2, seed:${seed}, attackerSide:true,
    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
  BATTLE_REPLAY_KAYITSIZ = true;                 // telemetri ACIK: combatEvents'ten sayacagiz
  const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
    brainIntel4:true, isAttacker:false, pro:false });
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;
  battleDeployManifest(mv, false, { source:"td", ally:true });
  startBattle(); SIM.headless = true;
  BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false;

  const son = new Map();
  const dolayliGorulen = new Set();
  let orn = 0, hareket = 0, menzilde = 0, hedefli = 0, bastir = 0;
  let st = 0;
  while (phase === PHASE.BATTLE && SIM.tick < 7200) {
    if (SIM.battle && SIM.battle.winnerSide !== null) break;
    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);
    battleLookaheadTick(st);
    if (SIM.tick % ${ORNEK} !== 0) continue;
    for (const u of SIM.units) {
      if (u.dead || u.loaded || u.abandoned || !u.isRed || !u.isIndirect) continue;
      orn++; dolayliGorulen.add(u.id);
      if (u.attackTarget && !u.attackTarget.dead) hedefli++;
      if ((u.suppression || 0) > 0.3) bastir++;
      let yakin = false;
      for (const e of SIM.units) {
        if (e.dead || e.loaded || e.isRed === u.isRed) continue;
        if (Math.hypot(e.x - u.x, e.y - u.y) <= (u.range || 0)) { yakin = true; break; }
      }
      if (yakin) menzilde++;
      const p = son.get(u.id);
      if (p && Math.hypot(u.x - p[0], u.y - p[1]) > 3) hareket++;
      son.set(u.id, [u.x, u.y]);
    }
  }
  /* İSABET: gerçek maçlarda kullandığım ölçünün AYNISI — combatEvents (isabet anında yazılır). */
  const co = (BATTLE_REPLAY.telemetry && BATTLE_REPLAY.telemetry.combatEvents) || [];
  const DOLAYLI = new Set([2,8,9,10]);
  let isabet = 0;
  for (const e of co) if (e.attackerSide === "red" && DOLAYLI.has(e.attackerType)) isabet++;
  /* ⚠ BIRIM SAYISI MAC SONUNDA SAG KALANLARDAN ALINAMAZ — cogu olmus olur ve bolen
     0/1 cikar (ilk surumde "birim basi isabet 3631.5" gibi sacma bir rakam uretti).
     Dogrusu: mac BOYUNCA gorulen ayri dolayli birim sayisi. dolayliGorulen ornekleme
     dongusunde dolduruluyor. */
  const dolayliSay = dolayliGorulen;
  const sagK = SIM.units.filter(u => !u.dead && u.isRed).length;
  const sagM = SIM.units.filter(u => !u.dead && !u.isRed).length;
  /* MARJ, MAC KAPISININ KULLANDIGI FORMULUN AYNISI (tools/rol-dengesi.js:142) — yoksa
     mekanizma kapisinin "sonuc isareti" ile mac kapisinin rakami kiyaslanamazdi. */
  const oS = battleArmyObservation(true), oD = battleArmyObservation(false);
  const marj = Math.round(oS.effectiveValue - oD.effectiveValue);
  return JSON.stringify({ orn, hareket, menzilde, hedefli, bastir, isabet,
    dolayli: dolayliSay.size, sagK, sagM, marj, sure: Math.round(SIM.tick * 0.05) });
})()`;
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'td-' + seed + '-' + acik + '.js' }));
}

const top = { false: { orn: 0, hareket: 0, menzilde: 0, hedefli: 0, bastir: 0, isabet: 0, dolayli: 0, sagK: 0, marj: 0 },
              true:  { orn: 0, hareket: 0, menzilde: 0, hedefli: 0, bastir: 0, isabet: 0, dolayli: 0, sagK: 0, marj: 0 } };
console.log('');
console.log('TOPCU ATES DISIPLINI — MEKANIZMA KAPISI (' + MAC + ' tohum)');
console.log('  gercek maclarda olculen: AI dolaylisi %42 hareket / oyuncu %13 · birim basi isabet 23.0 / 44.5');
console.log('');
for (let i = 0; i < MAC; i++) {
    const seed = TOHUM0 + i;
    for (const acik of [false, true]) {
        const r = kos(seed, acik);
        const t = top[acik];
        t.orn += r.orn; t.hareket += r.hareket; t.menzilde += r.menzilde; t.hedefli += r.hedefli;
        t.bastir += r.bastir; t.isabet += r.isabet; t.dolayli += r.dolayli; t.sagK += r.sagK; t.marj += r.marj;
        console.log('  tohum ' + seed + (acik ? '  kural ACIK ' : '  kural kapali') +
            '  hareket %' + (r.orn ? (r.hareket / r.orn * 100).toFixed(1) : '-') +
            '  menzilde %' + (r.orn ? (r.menzilde / r.orn * 100).toFixed(1) : '-') +
            '  dolayli isabet ' + r.isabet + ' (' + r.dolayli + ' birim)' +
            '  marj ' + Math.round(r.marj));
    }
}
console.log('');
for (const acik of [false, true]) {
    const t = top[acik];
    console.log('  ' + (acik ? 'ACIK  ' : 'KAPALI') +
        '  hareket %' + (t.orn ? (t.hareket / t.orn * 100).toFixed(1) : '-') +
        '   menzilde %' + (t.orn ? (t.menzilde / t.orn * 100).toFixed(1) : '-') +
        '   hedefli %' + (t.orn ? (t.hedefli / t.orn * 100).toFixed(1) : '-') +
        '   bastirilmis %' + (t.orn ? (t.bastir / t.orn * 100).toFixed(1) : '-') +
        '   BIRIM BASI ISABET ' + (t.dolayli ? (t.isabet / t.dolayli * MAC / MAC).toFixed(1) : '-'));
}
const hk = top[false].orn ? top[false].hareket / top[false].orn : 0;
const ha = top[true].orn ? top[true].hareket / top[true].orn : 0;
const ik = top[false].dolayli ? top[false].isabet / top[false].dolayli : 0;
const ia = top[true].dolayli ? top[true].isabet / top[true].dolayli : 0;
console.log('');
console.log('  DEGISIM: hareket payi %' + (hk * 100).toFixed(1) + ' -> %' + (ha * 100).toFixed(1) +
    '   birim basi isabet ' + ik.toFixed(1) + ' -> ' + ia.toFixed(1));
console.log('  KARAR: ' + (ha < hk * 0.7 ? 'mekanizma CALISIYOR -> mac kapisina girebilir'
    : 'hareket payi yeterince dusmedi -> mac kapisi HARCANMAZ'));
/* Sonuc isareti — DUSUK GUC, yon gosterir. */
const mjK = top[false].marj / MAC, mjA = top[true].marj / MAC;
const kK = top[false].sagK / MAC, kA = top[true].sagK / MAC;
console.log('');
console.log('  SONUC ISARETI (dusuk guc, yon gosterir): marj ' + Math.round(mjK) + ' -> ' + Math.round(mjA) +
    '  (fark ' + (mjA - mjK >= 0 ? '+' : '') + Math.round(mjA - mjK) + ')   sag kalan AI birimi ' +
    kK.toFixed(1) + ' -> ' + kA.toFixed(1));
if (mjA < mjK - 800 || kA < kK * 0.7) {
    console.log('  UYARI: mekanizma calissa da sonuc ve/veya sagkalim BELIRGIN KOTULESIYOR.');
    console.log('     (yerinde kalmak karsi-batarya yemek olabilir — tam da bu kuralin riski)');
}
console.log('');
