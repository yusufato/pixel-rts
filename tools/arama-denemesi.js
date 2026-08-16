'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  ARAMA DENEMESİ — "geleceği görerek seçmek" gerçekten daha iyi mi?
//
//  Kullanıcı fikri: AI bir hamlenin sonucunu ÖNCEDEN oynatıp görsün.
//  Altyapı hazır (tools/ileri-model-kapisi.js: aynı fork'tan rollout 27/27 birebir).
//  Bu araç MOTORA DOKUNMAZ; yalnız şunu ölçer:
//
//    Karar anında sezgisel sıralayıcının seçtiği plan ile, adayları GERÇEKTEN
//    oynatıp en iyi çıkanı seçmek arasında ne kadar fark var?
//
//  YÖNTEM (her karar anında):
//    1. fork al
//    2. her aday plan için: restore → planı ZORLA → ufuk boyunca oynat → marjı ölç
//       (ufuk boyunca yeniden karar almasın diye nextDecisionTick ileri itilir)
//    3. sezgiselin 1. sırası ile rollout-en-iyisini karşılaştır
//
//  NE ÖLÇER, NE ÖLÇMEZ:
//    · ÖLÇER: sezgisel sıralamanın gerçek sonuçla ne kadar örtüştüğü + kaçırılan marj.
//    · ÖLÇMEZ: canlı oyunda bu kazancın kalıcı olup olmayacağını. Rakip de tepki verir;
//      burada rakip rollout içinde KENDİ AI'sıyla oynar, yani en iyimser durum DEĞİL
//      ama tek-karar ufkuyla sınırlı. Kazanç görünürse asıl kanıt rol-dengesi kapısıdır.
//
//  ⚠ MEVCUT DURUM — NEGATIF SONUC (2026-08-16):
//  Bu kurguda plan ZORLAMA rollout sonucunu DEGISTIRMIYOR: her karar aninda 2-4 aday
//  planin hepsi BIREBIR ayni marj deltasini veriyor (yayilim 0). Iki acikamasi var ve
//  hangisi oldugu HENUZ AYRILMADI:
//    (a) zorlama etkisiz — plani `planCommitment.current` + `currentPlan` +
//        `operationalPlanner.build` uzerinden dayatiyorum; planlayici onbellegi
//        (forceOrganizer.cachedPlanId / taskContractPlanner.cachedKey) dusuruldu ama
//        sonuc degismedi, yani baska bir katman hareketi belirliyor olabilir
//        (guclu aday: BATTLE_SECTOR_COMMAND — sektor komutasi birim hareketini
//        plandan bagimsiz suruyor olabilir).
//    (b) plan secimi 15sn ufukta gercekten onemsiz — bu da bir bulgu olurdu.
//  AYIRT EDICI DENEY: sektor komutasini kapatip ayni olcumu tekrarla. Yayilim
//  aciliyorsa sebep (a), acilmiyorsa (b).
//  UYARI: yayilim 0 iken "sezgisel = rollout-en-iyi %66" gibi bir oran ANLAMSIZDIR
//  (butun adaylar berabere; siralama keyfi). O satiri yayilim>0 olmadan okuma.
//
//    node tools/arama-denemesi.js --tohum 6 --ufuk 300 --aday 4
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 6)) || 6);
const TOHUM0 = Number(arg('--tohum0', 100000)) || 100000;
const UFUK = Math.max(20, Number(arg('--ufuk', 300)) || 300);      // tik (300 = 15sn)
const ADAY = Math.max(2, Number(arg('--aday', 4)) || 4);
const KARAR_ANLARI = (arg('--anlar', '600,1200,1800,2400') || '').split(',').map(Number).filter(Boolean);

function kos(ctx, seed) {
    const kod = '(() => {' +
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
        'BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;' +
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;' +
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;' +
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;' +
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true,' +
        '  durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
        'BATTLE_REPLAY.telemetry = null;' +
        'if (typeof BATTLE_REPLAY_KAYITSIZ !== "undefined") BATTLE_REPLAY_KAYITSIZ = true;' +
        'const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,' +
        '  brainIntel4:true, isAttacker:false, pro:false });' +
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;' +
        'battleDeployManifest(mv, false, { source:"arama", ally:true });' +
        'startBattle(); SIM.headless = true;' +
        'const ANLAR = ' + JSON.stringify(KARAR_ANLARI) + ', UFUK = ' + UFUK + ', ADAY = ' + ADAY + ';' +
        'const marj = () => { const a = battleArmyObservation(true), d = battleArmyObservation(false);' +
        '  return a.effectiveValue - d.effectiveValue; };' +
        'const out = []; let st = 0;' +
        'for (const an of ANLAR) {' +
        '  while (SIM.tick < an && phase === PHASE.BATTLE) { st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false); }' +
        '  if (phase !== PHASE.BATTLE) break;' +
        '  const c = [...BATTLE_CONTROLLERS.values()].find(x => x.id === "battle-red-ai");' +   // SALDIRAN
        '  if (!c || !c.rankedPlans || c.rankedPlans.length < 2) continue;' +
        '  const adaylar = c.rankedPlans.slice(0, ADAY).map(p => replayClone(p));' +
        '  const sezgiselSecim = (c.planCommitment && c.planCommitment.current && c.planCommitment.current.kind)' +
        '    ? c.planCommitment.current.kind : (adaylar[0] && adaylar[0].kind);' +
        '  const f = battleForkCapture();' +
        '  const basMarj = marj();' +
        '  const skor = [];' +
        '  for (const plan of adaylar) {' +
        '    battleForkRestore(f);' +
        '    const c2 = [...BATTLE_CONTROLLERS.values()].find(x => x.id === "battle-red-ai");' +
        // PLANI ZORLA: taahhüdü doğrudan bu plana kur ve ufuk boyunca yeniden karar aldırma
        '    if (c2.planCommitment) c2.planCommitment.current = Object.assign(replayClone(plan), { id: "arama:" + plan.kind, selectedAtTick: SIM.tick, minUntilTick: SIM.tick + UFUK + 1 });' +
        '    c2.currentPlan = replayClone(c2.planCommitment.current);' +
        /* PLANLAYICI ONBELLEGINI DUSUR: forceOrganizer/taskContractPlanner fork'tan
           RESTORE ediliyor; onbellek anahtari eslesince build() yeni plani YOK SAYIP
           eski sozlesmeleri donduruyordu. Ilk olcumde dort adayin dortu de BIREBIR
           ayni delta verdi (yayilim 0) - zorlama etkisizdi. */
        '    if (c2.operationalPlanner) {' +
        '      const _op = c2.operationalPlanner;' +
        '      if (_op.forceOrganizer) { _op.forceOrganizer.cachedPlanId = null; _op.forceOrganizer.cachedUnitSignature = null; _op.forceOrganizer.cachedGroups = []; }' +
        '      if (_op.taskContractPlanner) { _op.taskContractPlanner.cachedKey = null; _op.taskContractPlanner.cachedContracts = []; }' +
        '      _op.lastPlan = null;' +
        '      c2.operationalPlan = _op.build(c2.currentPlan, c2.lastObservation, c2.lastSituation);' +
        '    }' +
        '    c2.nextDecisionTick = SIM.tick + UFUK + 1;' +
        '    let s2 = st;' +
        '    for (let i = 0; i < UFUK && phase === PHASE.BATTLE; i++) { s2 += BATTLE_TICK_MS; stepSim(s2, BATTLE_TICK_SEC, battleControllersDrive, false); }' +
        '    skor.push({ id: plan.kind, skorSezgisel: plan.score, delta: Math.round(marj() - basMarj) });' +
        '  }' +
        '  battleForkRestore(f);' +
        '  skor.sort((a, b) => b.delta - a.delta);' +
        '  const enIyi = skor[0];' +
        '  const sezgiselSkor = skor.find(x => x.id === sezgiselSecim) || null;' +
        '  out.push({ tik: an, aday: skor.length, sezgisel: sezgiselSecim,' +
        '    enIyi: enIyi.id, ayniMi: enIyi.id === sezgiselSecim,' +
        '    enIyiDelta: enIyi.delta, sezgiselDelta: sezgiselSkor ? sezgiselSkor.delta : null,' +
        '    yayilim: enIyi.delta - skor[skor.length - 1].delta, ham: skor, faz: phase, tikSon: SIM.tick });' +
        '}' +
        'return JSON.stringify({ seed: ' + seed + ', kararlar: out });' +
        '})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'arama-' + seed + '.js' }));
}

function main() {
    const { ctx, hatalar } = tezgahKur();
    if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }

    const hepsi = [];
    for (let i = 0; i < N; i++) {
        const r = kos(ctx, TOHUM0 + i);
        hepsi.push(...r.kararlar);
        process.stdout.write('  tohum ' + (i + 1) + '/' + N + '  karar ' + hepsi.length + '\r');
    }
    console.log(' '.repeat(40) + '\r');

    if (!hepsi.length) { console.log('KARAR NOKTASI BULUNAMADI (aday plan < 2)'); return; }
    if (process.argv.includes('--ham')) { for (const k of hepsi.slice(0, 4)) console.log(JSON.stringify(k)); }

    const olculen = hepsi.filter(k => k.sezgiselDelta != null);
    const ayni = olculen.filter(k => k.ayniMi).length;
    const kacirilan = olculen.map(k => k.enIyiDelta - k.sezgiselDelta);
    const ortKacirilan = kacirilan.reduce((a, b) => a + b, 0) / Math.max(1, kacirilan.length);
    const ortYayilim = olculen.reduce((a, k) => a + k.yayilim, 0) / Math.max(1, olculen.length);
    const std = Math.sqrt(kacirilan.reduce((a, b) => a + (b - ortKacirilan) ** 2, 0) / Math.max(1, kacirilan.length - 1));
    const t = ortKacirilan / (std / Math.sqrt(Math.max(1, kacirilan.length)));

    console.log('ARAMA DENEMESI — ' + N + ' tohum, ufuk ' + UFUK + ' tik (' + Math.round(UFUK * 0.05) + 'sn), ' + ADAY + ' aday');
    console.log('');
    console.log('  olculen karar noktasi     : ' + olculen.length);
    console.log('  sezgisel = rollout-en-iyi : ' + ayni + '/' + olculen.length +
        ' = %' + (ayni / olculen.length * 100).toFixed(1));
    console.log('  ADAYLAR ARASI YAYILIM     : ' + Math.round(ortYayilim) + ' marj  (secim ne kadar ONEMLI)');
    console.log('  SEZGISELIN KACIRDIGI      : ' + Math.round(ortKacirilan) + ' marj/karar' +
        '   std ' + Math.round(std) + '   t ' + t.toFixed(2) +
        (Math.abs(t) >= 2 ? '  -> ANLAMLI' : '  -> anlamli DEGIL'));
    console.log('');
    console.log('  NOT: kacirilan marj bir UST SINIRDIR — rollout gercek rakibi oynatir,');
    console.log('  yani secim aninda bilinemeyecek bilgiyi kullanir. Canli kazanc bunun altinda kalir.');
}

main();
