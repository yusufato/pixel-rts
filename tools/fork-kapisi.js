'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  FORK KAPISI — aramanın zemini gerçekten sabit mi?
//
//  İleri-bakış araması aynı durumu defalarca ileri oynatır. Bu ancak fork sınırı
//  SIZDIRMIYORSA anlamlıdır. Bugüne kadar iki ayrı kaçak ölçülerek bulundu:
//    · kontrolör ağacının 8724 alanından 2785'i restore sonrası eski hâline dönmüyordu
//    · `battleForkRestore` MAYINLARI siliyordu, capture onları hiç almıyordu
//      (aramanın her turu haritadaki bütün mayınları yok ediyordu — 2026-08-17)
//  İkincisi aylarca görünmedi çünkü KAPI YOKTU. Bu araç o kapıdır.
//
//  İKİ AYRI ÖLÇÜ (biri diğerini yakalamaz):
//    A) SADAKAT : capture→restore durumu DEĞİŞTİRMEMELİ.  hash(önce) == hash(sonra)
//                 Mayın kusuru tam BURADA düşer (restore siliyordu).
//    B) TEKRAR  : aynı fork'tan N rollout AYNI sonucu vermeli. hash(r1)==hash(r2)==...
//                 Kontrolör kaçağı BURADA düşer (rollout-1 zemini kirletiyordu).
//  A geçip B düşebilir ve tersi — ikisi de koşulur.
//
//  NEGATİF KONTROL: kasıtlı bir kaçak enjekte edilir (mayın dizisi capture'dan silinir);
//  kapı bunu YAKALAMALI. Yakalamıyorsa kapı kördür.
//
//    node tools/fork-kapisi.js [--tohum 3] [--nokta 4] [--tekrar 3]
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 3)) || 3);
const TOHUM0 = Number(arg('--tohum0', 700000)) || 700000;
const NOKTA = Math.max(1, Number(arg('--nokta', 4)) || 4);      // maçta kaç ayrı anda sınansın
const TEKRAR = Math.max(2, Number(arg('--tekrar', 3)) || 3);    // aynı fork'tan kaç rollout
const UFUK = Number(arg('--ufuk', 60)) || 60;                   // rollout uzunluğu (tik)
const ARA = Number(arg('--ara', 400)) || 400;                   // sınama noktaları arası tik

function kos(ctx, seed, sabotaj) {
    const kod = `(() => {
  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
  BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;
  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;
  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;
  openBattlefieldSession({ mode:"quick", mapId:-2, seed:${seed}, attackerSide:true,
    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;
  const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
    brainIntel4:true, isAttacker:false, pro:false });
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;
  battleDeployManifest(mv, false, { source:"forkkapi", ally:true });
  startBattle(); SIM.headless = true;
  BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false;   // kapi FORK'u olcer, aramayi degil

  ${sabotaj ? `
  // ── NEGATIF KONTROL: capture'dan mayinlari SIL (2026-08-17 kusurunun aynisi) ──
  const _eskiCapture = battleForkCapture;
  battleForkCapture = function () { const f = _eskiCapture(); f.mines = []; return f; };
  ` : ''}

  const sadakat = [], tekrar = [], json = [], detay = [];
  let st = 0, nokta = 0;
  while (SIM.tick < ${(NOKTA + 1) * ARA + 50} && phase === PHASE.BATTLE && nokta < ${NOKTA}) {
    if (SIM.battle && SIM.battle.winnerSide !== null) break;
    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);
    if (SIM.tick % ${ARA} !== 0 || SIM.tick === 0) continue;
    nokta++;

    const _g = BATTLE_SIM_GOLGE; BATTLE_SIM_GOLGE = true;
    const once = battleStateHash();
    const onceP = battleStateHashParts();
    const f = battleForkCapture();
    battleForkRestore(f);
    const sonra = battleStateHash();
    const sonraP = battleStateHashParts();
    sadakat.push({ tik: SIM.tick, ok: once === sonra });
    if (once !== sonra) {
      detay.push({ tik: SIM.tick, tur: 'SADAKAT',
        parca: ['g','b','u','t','s'].filter(k => onceP[k] !== sonraP[k]).join(',') || '(yok)' });
    }

    /* C) JSON SADAKATI — fork'un NESNE hali ile JSON'dan gecmis hali DENK mi?
       KUSUR (2026-08-18): degildi. lastFieldBuiltAt ve lastFireWindowTick alanlari
       -Infinity idi; JSON onlari null yapiyordu ve geri yuklenen dunya ~20 tik sonra
       AYRILIYORDU. Worker fork'u JSON ile tasidigi icin bu, "isci farkli oynuyor" gibi
       gorunup teshisi isciye yonlendirdi — oysa kusur MOTORDAYDI ve ana taraf kendi
       icinde bile tekrarlanamiyordu. Bu olcu o sinifi kalici olarak kapatir. */
    const jf = JSON.parse(JSON.stringify(f));
    const jkos = (fk) => {
      battleForkRestore(fk);
      let s3 = st;
      for (let i = 0; i < ${UFUK} && phase === PHASE.BATTLE; i++) {
        s3 += BATTLE_TICK_MS; stepSim(s3, BATTLE_TICK_SEC, battleControllersDrive, false);
      }
      return battleStateHash();
    };
    const jNesne = jkos(f), jJson = jkos(jf);
    json.push({ tik: SIM.tick, ok: jNesne === jJson });
    if (jNesne !== jJson) detay.push({ tik: SIM.tick, tur: 'JSON', parca: jNesne + ' vs ' + jJson });

    // B) AYNI FORK'TAN ${TEKRAR} ROLLOUT — hepsi ayni hash vermeli
    const hh = [];
    for (let r = 0; r < ${TEKRAR}; r++) {
      battleForkRestore(f);
      let s2 = st;
      for (let i = 0; i < ${UFUK} && phase === PHASE.BATTLE; i++) {
        s2 += BATTLE_TICK_MS; stepSim(s2, BATTLE_TICK_SEC, battleControllersDrive, false);
      }
      hh.push(battleStateHash());
    }
    const ayni = hh.every(h => h === hh[0]);
    tekrar.push({ tik: SIM.tick, ok: ayni });
    if (!ayni) detay.push({ tik: SIM.tick, tur: 'TEKRAR', parca: hh.join(' ') });

    battleForkRestore(f);
    BATTLE_SIM_GOLGE = _g;
  }
  ${sabotaj ? 'battleForkCapture = _eskiCapture;' : ''}
  return JSON.stringify({ seed:${seed}, sadakat, tekrar, json, detay, tik: SIM.tick });
})()`;
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'fk-' + seed + '.js' }));
}

function main() {
    const { ctx, hatalar } = tezgahKur();
    if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }
    console.log('FORK KAPISI — ' + N + ' tohum x ' + NOKTA + ' nokta, ' + TEKRAR + ' tekrar, ufuk ' + UFUK + ' tik');
    console.log('');
    let sT = 0, sOk = 0, tT = 0, tOk = 0, jT = 0, jOk = 0;
    for (let i = 0; i < N; i++) {
        const seed = TOHUM0 + i;
        const r = kos(ctx, seed, false);
        const so = r.sadakat.filter(x => x.ok).length, tk = r.tekrar.filter(x => x.ok).length;
        const jk = (r.json || []).filter(x => x.ok).length;
        sT += r.sadakat.length; sOk += so; tT += r.tekrar.length; tOk += tk;
        jT += (r.json || []).length; jOk += jk;
        console.log('  tohum ' + seed + '   SADAKAT ' + so + '/' + r.sadakat.length +
            '   TEKRAR ' + tk + '/' + r.tekrar.length + '   JSON ' + jk + '/' + (r.json || []).length +
            '   (' + r.tik + ' tik)');
        for (const d of r.detay) console.log('    ! tik ' + d.tik + '  ' + d.tur + '  ' + d.parca);
    }
    console.log('');
    console.log('NEGATIF KONTROL (capture mayinlari atiyor — kapi YAKALAMALI):');
    const n = kos(ctx, TOHUM0, true);
    const nSad = n.sadakat.filter(x => !x.ok).length;
    console.log('  sadakat DUSEN nokta: ' + nSad + '/' + n.sadakat.length + '   ' +
        (nSad > 0 ? 'YAKALANDI (kapi CALISIYOR)' : '*** KACIRDI -> KAPI KOR ***'));
    console.log('');
    console.log('  SADAKAT: ' + sOk + '/' + sT + '   TEKRAR: ' + tOk + '/' + tT + '   JSON: ' + jOk + '/' + jT);
    console.log('  (JSON = forkun nesne hali ile JSON hali DENK mi — Worker bunu tasiyor)');
    const gecti = sOk === sT && tOk === tT && jOk === jT && nSad > 0;
    console.log('  KAPI: ' + (gecti ? 'GECTI' : 'DUSTU'));
    process.exit(gecti ? 0 : 1);
}

main();
