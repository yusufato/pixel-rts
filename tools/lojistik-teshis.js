'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  LOJİSTİK TEŞHİSİ (A) — "ikmal aracı ölünce ordu kuruyor mu?"
//
//  KULLANICININ MAÇINDAN ÇIKTI (tohum 363148901): AI'nın TEK ikmal aracı 52sn'de öldü.
//  Sonrasında RESUPPLY olayı SIFIR (oyuncu 215). Topçusu 90sn'de kurudu ve 170 saniye
//  boş gezdi; çöküş döneminde dolaylı ateşin %93'ü "Cephanesiz". Maç 140sn'de berabereydi.
//
//  ⚠ AMA TEK MAÇ ANEKDOTTUR. Bu araç sorar: bu bir DESEN mi, o maça özgü mü?
//    · ikmal aracı ne zaman ölüyor (dağılım)
//    · öldükten sonra ordunun cephane eğrisi ne oluyor
//    · ikmal ölümü ile maç sonucu arasında ilişki var mı
//  Ölçüm ÖNCE, düzeltme SONRA — bu projede tersi birkaç kez pahalıya patladı.
//
//    node tools/lojistik-teshis.js --mac 8
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 8)) || 8);
const TOHUM0 = Number(arg('--tohum0', 102000)) || 102000;
const MAX_TIK = Number(arg('--maxtik', 5600)) || 5600;
/* ⚠ KURULUM KULLANICININ MACIYLA AYNI OLMALI. Ilk kosuda AI'yi SALDIRAN ve ARAMASIZ
   kosturdum; kullanicinin macinda AI SAVUNANDI ve worker aciykti. O kurguda "ikmal
   olunce topcu kurur" deseni CIKMADI cunku topcu zaten olmustu — yani olcum yanlis
   soruyu cevapladi. Bayraklar bu yuzden disarida. */
const SAVUNAN = process.argv.includes('--savunan');   // AI (kirmizi) savunsun
const YEDEK = process.argv.includes('--yedek');       // lojistik kurali acik + asgari 2 ikmal
const ARAMA = process.argv.includes('--arama');       // ileri-bakis acik (ONGORU gibi)

const { ctx, hatalar } = tezgahKur();
if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }

function kos(seed) {
    const kod = `(() => {
  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
  BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;
  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;
  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;
  BATTLE_LOJISTIK_INTEL4 = ${YEDEK ? 'true' : 'false'};
  BATTLE_LOJISTIK_MIN = ${YEDEK ? 2 : 0};
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;
  openBattlefieldSession({ mode:"quick", mapId:-2, seed:${seed}, attackerSide:${SAVUNAN ? 'false' : 'true'},
    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;
  const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
    brainIntel4:true, isAttacker:false, pro:false });
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;
  battleDeployManifest(mv, false, { source:"loj", ally:true });
  startBattle(); SIM.headless = true;
  BATTLE_LOOKAHEAD_RED = ${ARAMA ? 'true' : 'false'}; BATTLE_LOOKAHEAD_BLUE = false;

  const IKMAL = T.SUPPLY;
  const DOLAYLI = [T.MORTAR, T.ARTILLERY, T.MLRS].filter(x => x != null);
  const ikmalSay = (r) => SIM.units.filter(u => !u.dead && u.isRed === r && u.type === IKMAL).length;
  const bas = { kirmizi: ikmalSay(true), mavi: ikmalSay(false) };
  let ikmalOlum = { kirmizi: null, mavi: null };
  const egri = [];      // {sn, kCephane, mCephane, kIkmal, mIkmal}
  let st = 0;
  while (SIM.tick < ${MAX_TIK} && phase === PHASE.BATTLE) {
    if (SIM.battle && SIM.battle.winnerSide !== null) break;
    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);
    ${ARAMA ? 'if (typeof battleLookaheadTick === "function") battleLookaheadTick(st);' : ''}
    const ki = ikmalSay(true), mi = ikmalSay(false);
    if (ikmalOlum.kirmizi === null && bas.kirmizi > 0 && ki === 0) ikmalOlum.kirmizi = SIM.tick * BATTLE_TICK_SEC;
    if (ikmalOlum.mavi === null && bas.mavi > 0 && mi === 0) ikmalOlum.mavi = SIM.tick * BATTLE_TICK_SEC;
    if (SIM.tick % 100) continue;
    /* ⚠ ILK SURUM SADECE ORTALAMA CEPHANE yaziyordu ve "ikmal olduktan sonra" hucresi
       BOS cikti (0 ornek). Sebep: o anda AI'nin dolayli ates birimi KALMAMIS oluyordu,
       yani soru "cephane ne oldu" degil "birim mi kaldi" idi. Simdi ikisi AYRI yazilir:
       birim sayisi, ortalama cephane ve KURU (ammo 0) birim sayisi. */
    const olc = (r) => {
      const us = SIM.units.filter(u => !u.dead && u.isRed === r && DOLAYLI.includes(u.type) && (u.maxAmmo || 0) > 0);
      if (!us.length) return { n: 0, cep: null, kuru: 0 };
      return { n: us.length,
        cep: us.reduce((a, u) => a + (u.ammo || 0) / u.maxAmmo, 0) / us.length,
        kuru: us.filter(u => (u.ammo || 0) <= 0).length };
    };
    const K = olc(true), M = olc(false);
    egri.push({ sn: Math.round(SIM.tick * BATTLE_TICK_SEC),
      kn: K.n, kc: K.cep, kk: K.kuru, mn: M.n, mc: M.cep, mk: M.kuru, ki, mi });
  }
  const b = SIM.battle || {};
  const oS = battleArmyObservation(true), oD = battleArmyObservation(false);
  return JSON.stringify({ seed:${seed}, bas, ikmalOlum, egri,
    marj: Math.round(oS.effectiveValue - oD.effectiveValue),
    kazanan: b.winnerSide === true ? 'kirmizi' : b.winnerSide === false ? 'mavi' : '-',
    sn: Math.round(SIM.tick * BATTLE_TICK_SEC) });
})()`;
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'loj-' + seed + '.js' }));
}

console.log('LOJİSTİK TEŞHİSİ — ' + MAC + ' maç (AI = kırmızı, ' +
    (SAVUNAN ? 'SAVUNAN' : 'saldıran') + ', arama ' + (ARAMA ? 'AÇIK' : 'kapalı') +
    ', lojistik kuralı ' + (YEDEK ? 'AÇIK (asgari 2)' : 'kapalı') + ')');
console.log('');
const hepsi = [];
for (let i = 0; i < MAC; i++) {
    const r = kos(TOHUM0 + i);
    hepsi.push(r);
    console.log('  tohum ' + r.seed + '  ikmal(k/m) ' + r.bas.kirmizi + '/' + r.bas.mavi +
        '  ölüm k ' + (r.ikmalOlum.kirmizi != null ? Math.round(r.ikmalOlum.kirmizi) + 'sn' : 'yaşadı') +
        ' · m ' + (r.ikmalOlum.mavi != null ? Math.round(r.ikmalOlum.mavi) + 'sn' : 'yaşadı') +
        '   marj ' + (r.marj > 0 ? '+' : '') + r.marj + '  (' + r.sn + 'sn)');
}

// ── ÖLÜM ZAMANI DAĞILIMI ─────────────────────────────────────────────────
const olduK = hepsi.filter(r => r.ikmalOlum.kirmizi != null).map(r => r.ikmalOlum.kirmizi).sort((a, b) => a - b);
const olduM = hepsi.filter(r => r.ikmalOlum.mavi != null).map(r => r.ikmalOlum.mavi).sort((a, b) => a - b);
console.log('');
console.log('  İKMAL ARACI ÖLÜMÜ');
console.log('     kırmızı(AI): ' + olduK.length + '/' + hepsi.length + ' maçta öldü' +
    (olduK.length ? '   medyan ' + Math.round(olduK[Math.floor(olduK.length / 2)]) + 'sn   en erken ' + Math.round(olduK[0]) + 'sn' : ''));
console.log('     mavi       : ' + olduM.length + '/' + hepsi.length + ' maçta öldü' +
    (olduM.length ? '   medyan ' + Math.round(olduM[Math.floor(olduM.length / 2)]) + 'sn   en erken ' + Math.round(olduM[0]) + 'sn' : ''));

// ── İKMAL ÖLÜMÜNDEN SONRA: BIRIM MI CEPHANE MI ───────────────────────────
console.log('');
console.log('  DOLAYLI ATEŞ — ikmal aracının durumuna göre (kırmızı/AI)');
const kutu = { sag: { n: 0, cep: 0, kuru: 0, birim: 0 }, olu: { n: 0, cep: 0, kuru: 0, birim: 0 } };
for (const r of hepsi) {
    const o = r.ikmalOlum.kirmizi;
    for (const e of r.egri) {
        const k = (o != null && e.sn >= o) ? kutu.olu : kutu.sag;
        k.n++; k.birim += e.kn;
        if (e.kc != null) { k.cep += e.kc; k.kuru += e.kk; }
    }
}
for (const [ad, k] of [['ikmal SAĞ  ', kutu.sag], ['ikmal ÖLDÜ ', kutu.olu]]) {
    if (!k.n) { console.log('     ' + ad + ' örnek YOK'); continue; }
    const cepliOrnek = hepsi.reduce((a, r) => a, 0);
    console.log('     ' + ad + ' örnek ' + String(k.n).padStart(4) +
        '   ayakta dolaylı birim/örnek ' + (k.birim / k.n).toFixed(2) +
        '   ortalama cephane ' + (k.cep / Math.max(1, k.n) * 100).toFixed(0) + '%' +
        '   kuru birim/örnek ' + (k.kuru / Math.max(1, k.n)).toFixed(2));
}
console.log('     (ayakta birim düşükse sorun CEPHANE değil HAYATTA KALMA — ikisi farklı kusur)');

// ── SONUÇLA İLİŞKİ ───────────────────────────────────────────────────────
const erken = hepsi.filter(r => r.ikmalOlum.kirmizi != null && r.ikmalOlum.kirmizi < 120);
const gec = hepsi.filter(r => !(r.ikmalOlum.kirmizi != null && r.ikmalOlum.kirmizi < 120));
const marjOrt = (v) => v.length ? Math.round(v.reduce((a, r) => a + r.marj, 0) / v.length) : null;
console.log('');
console.log('  SONUÇLA İLİŞKİ');
console.log('     ikmal ERKEN öldü (<120sn): ' + erken.length + ' maç, ortalama marj ' + marjOrt(erken));
console.log('     ikmal geç/hiç:             ' + gec.length + ' maç, ortalama marj ' + marjOrt(gec));
console.log('');
console.log('  ⚠ n=' + MAC + ' KARAR VERDİRMEZ (marj std ≈ 2600). Bu bir DESEN taraması;');
console.log('    düzeltme adayı çıkarsa mekanizma + maç kapısı ayrıca koşar.');
