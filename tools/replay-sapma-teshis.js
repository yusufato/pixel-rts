'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  REPLAY SAPMASI — HANGİ BİRİMİN HANGİ ALANI?
//
//  arama-replay-kapisi.js "SAPMA @tik N" diyor ama sapan alanı söylemiyor. Bu araç
//  canlı koşuda her 20 tikte TÜM birimlerin hash'e giren alanlarını ham olarak saklar,
//  sonra replay'de aynı tiklerde karşılaştırır ve İLK farkı alan adıyla basar.
//
//  NEDEN GEREKLİ: kapı 2026-08-17'de 4/4 geçiyordu, bugün taban durumda 2/4. Yani
//  aradaki bir değişiklik replay sözleşmesini bozdu. Sapan alan bilinmeden hangi
//  değişikliğin bozduğu tahmin edilemez — bu projede "tahminle teşhis" kayıtlı bir
//  hata sınıfı.
//
//    node tools/replay-sapma-teshis.js --tohum 500003 [--maxtik 1200] [--koruma 0]
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const SEED = Number(arg('--tohum', 500003)) || 500003;
const MAX_TIK = Number(arg('--maxtik', 1200)) || 1200;
const KORUMA = Math.max(0, Number(arg('--koruma', 0)) || 0);
const ARALIK = Math.max(1, Number(arg('--aralik', 20)) || 20);

const { ctx, hatalar } = tezgahKur();
if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }

// Hash'e giren birim alanları (battleStateHashParts `u` bölümüyle AYNI sıra)
const ALAN = ['id', 'type', 'isRed', 'ally', 'controlOwner', 'controllerId', 'x', 'y', 'hp', 'ammo',
    'suppression', 'isFleeing', 'attackTargetId', 'targetX', 'targetY', 'operatorId',
    'payloadCount', 'reloadTimer', 'retired', 'refuelBaseKey'];

const kod = `(() => {
  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
  BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;
  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;
  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;
  openBattlefieldSession({ mode:"quick", mapId:-2, seed:${SEED}, attackerSide:true,
    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
  BATTLE_REPLAY_KAYITSIZ = false;
  const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
    brainIntel4:true, isAttacker:false, pro:false });
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;
  battleDeployManifest(mv, false, { source:"sapma", ally:true });
  startBattle(); SIM.headless = true;
  BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false;
  BATTLE_LA_EMIR_KORUMA = ${KORUMA};

  const r2 = (v) => Math.round((v || 0) * 100);
  const kes = () => {
    const o = {};
    for (const u of SIM.units) {
      if (u.dead) continue;
      o[u.id] = [u.id, u.type, u.isRed?1:0, u.ally?1:0, u.controlOwner||'-', u.controllerId||'-',
        r2(u.x), r2(u.y), r2(u.hp), r2(u.ammo), r2(u.suppression), u.isFleeing?1:0,
        (u.attackTarget && !u.attackTarget.dead) ? u.attackTarget.id : 0,
        r2(u.targetX), r2(u.targetY), u.operatorId != null ? u.operatorId : '-',
        u.payloadCount != null ? u.payloadCount : '-', Math.round(u._reloadTimer||0),
        u._retired?1:0, u._refuelBaseKey||'-'];
    }
    return o;
  };
  // SIPER + MAYIN + birimin mayin-rotasi: t parcasi bunlardan olusuyor. Ayri kesilir ki
  // "siper mi mayin mi" sorusu tahmin degil OLCUM olsun.
  const kesT = () => ({
    siper: (SIM.trenches||[]).slice().sort((a,b)=>(a.x-b.x)||(a.y-b.y))
      .map(f => [r2(f.x), r2(f.y), f.isRed?1:0, r2(f.hp), f.expiresAt||0, f.refuelsLeft==null?'-':f.refuelsLeft, f.isHospital?1:0]),
    mayin: (SIM.mines||[]).slice().sort((a,b)=>(a.x-b.x)||(a.y-b.y))
      .map(m => [r2(m.x), r2(m.y), m.isRed?1:0, m.armed?1:0]),
    rota: SIM.units.filter(u=>!u.dead && (u.mineRoute&&u.mineRoute.length || u._mineLayTimer))
      .sort((a,b)=>a.id-b.id)
      .map(u => [u.id, u.mineRoute?u.mineRoute.length:0,
                 u.mineRoute&&u.mineRoute.length?r2(u.mineRoute[0].x):'-',
                 u.mineRoute&&u.mineRoute.length?r2(u.mineRoute[0].y):'-',
                 Math.round((u._mineLayTimer||0)*1000)])
  });

  const canli = {}, canliP = {}, canliT = {};
  let st = 0;
  while (SIM.tick < ${MAX_TIK} && phase === PHASE.BATTLE) {
    if (SIM.battle && SIM.battle.winnerSide !== null) break;
    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, true);
    // ÖRNEKLEME NOKTASI: stepSim'in HEMEN ARDINDAN — sürücünün hash aldığı fazla aynı.
    // (İlk sürümde örnek battleLookaheadTick'ten SONRA alınıyordu; o an canlıda emirler
    //  işlenmiş, replay'de HENÜZ değildi → araç her koşuda sahte "tik 100 sapması" basıyordu.)
    if (SIM.tick % ${ARALIK} === 0) { canli[SIM.tick] = kes(); canliP[SIM.tick] = battleStateHashParts(); canliT[SIM.tick] = kesT(); }
    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);
    battleLookaheadTick(st);
  }
  const canliTik = SIM.tick;
  const kayit = exportBattleReplay();

  // ── REPLAY ──
  BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false;
  startBattleReplay(kayit); SIM.headless = true;
  let s2 = 0, ilk = null;
  while (SIM.tick < canliTik && phase === PHASE.BATTLE) {
    s2 += BATTLE_TICK_MS; stepSim(s2, BATTLE_TICK_SEC, battleReplayDrive, true);
    const _es = (SIM.tick % ${ARALIK}) === 0 ? kes() : null;
    const _ep = _es ? battleStateHashParts() : null;
    const _et = _es ? kesT() : null;
    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, s2);
    if (ilk || !_es) continue;
    const c = canli[SIM.tick]; if (!c) continue;
    const r = _es;
    const p0 = canliP[SIM.tick], p1 = _ep;
    const parcaFark = ['g','b','u','t','s'].filter(k => p0[k] !== p1[k]);
    const farklar = [];
    const idler = new Set(Object.keys(c).concat(Object.keys(r)));
    for (const id of idler) {
      const a = c[id], b = r[id];
      if (!a) { farklar.push({ id:+id, alan:'YOK_CANLIDA' }); continue; }
      if (!b) { farklar.push({ id:+id, alan:'YOK_REPLAYDE', tip:a[1] }); continue; }
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) farklar.push({ id:+id, alanIx:i, canli:a[i], replay:b[i], tip:a[1] });
      }
    }
    if (parcaFark.length || farklar.length) {
      const t0 = canliT[SIM.tick], t1 = _et;
      const tf = {};
      for (const k of ['siper','mayin','rota']) {
        const a = JSON.stringify(t0[k]), b = JSON.stringify(t1[k]);
        if (a === b) continue;
        tf[k] = { canliSay: t0[k].length, replaySay: t1[k].length,
          canli: t0[k].filter(x => !t1[k].some(y => JSON.stringify(y) === JSON.stringify(x))).slice(0, 6),
          replay: t1[k].filter(x => !t0[k].some(y => JSON.stringify(y) === JSON.stringify(x))).slice(0, 6) };
      }
      ilk = { tik: SIM.tick, parcaFark, farklar: farklar.slice(0, 20), toplamFark: farklar.length, tf };
    }
  }
  return JSON.stringify({ seed:${SEED}, canliTik, ilk,
    surucuSapma: BATTLE_REPLAY_DRIVER.divergence ? BATTLE_REPLAY_DRIVER.divergence.tick : null });
})()`;

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'sapma.js' }));
console.log('REPLAY SAPMA TESHISI — tohum ' + r.seed + ', canli ' + r.canliTik + ' tik, koruma ' + KORUMA);
console.log('  surucunun bildirdigi sapma tiki: ' + (r.surucuSapma == null ? 'YOK' : r.surucuSapma));
if (!r.ilk) { console.log('  BIREBIR AYNI — alan farki yok'); process.exit(0); }
console.log('');
console.log('  ILK FARK @tik ' + r.ilk.tik);
console.log('  sapan hash parcasi: ' + (r.ilk.parcaFark.length ? r.ilk.parcaFark.join(',') : '(yok)') +
    '   [g=global b=battle u=birim t=siper/mayin s=destek/bekleyen]');
console.log('  alan farki sayisi : ' + r.ilk.toplamFark);
if (r.ilk.tf && Object.keys(r.ilk.tf).length) {
    console.log('');
    console.log('  --- SIPER/MAYIN/ROTA FARKI ---');
    const AD = { siper: '[x,y,kirmizi,hp,bitis,dolum,hastane]', mayin: '[x,y,kirmizi,kurulu]',
        rota: '[birim,kalanNokta,ilkX,ilkY,dosemeSayaci]' };
    for (const k of Object.keys(r.ilk.tf)) {
        const d = r.ilk.tf[k];
        console.log('    ' + k + ': canli ' + d.canliSay + ' adet, replay ' + d.replaySay + ' adet   ' + AD[k]);
        for (const x of d.canli) console.log('      YALNIZ CANLIDA : ' + JSON.stringify(x));
        for (const x of d.replay) console.log('      YALNIZ REPLAYDE: ' + JSON.stringify(x));
    }
}
if (!r.ilk.farklar.length) { console.log('  (birim alanlari ayni -> fark birim DISINDA)'); process.exit(0); }
console.log('');
console.log('  ' + 'birim'.padEnd(8) + 'tip'.padEnd(6) + 'alan'.padEnd(18) + 'canli'.padStart(12) + 'replay'.padStart(12));
for (const f of r.ilk.farklar) {
    console.log('  ' + String(f.id).padEnd(8) + String(f.tip == null ? '-' : f.tip).padEnd(6) +
        (f.alan || ALAN[f.alanIx] || ('#' + f.alanIx)).padEnd(18) +
        String(f.canli).padStart(12) + String(f.replay).padStart(12));
}
