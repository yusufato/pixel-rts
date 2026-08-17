'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  ARAMA TAVANI — "25 adayın HEPSİNİ oynatsak ne kazanırdık?"
//
//  NEDEN BU ÖLÇÜM ÖNCE YAPILMALI:
//  Değer ağı + GPU yolunun TAMAMI tek bir varsayıma dayanıyor: "daha çok adayı
//  değerlendirebilirsek daha iyi seçeriz". Bu varsayım HİÇ SINANMADI.
//  Arama şu an 25 adaydan yalnız LA_DERIN=2 tanesini oynatıyor. Eğer 25'in
//  hepsinden gerçek en iyiyi seçmek, bugünkü 2'lik seçimden belirgin daha iyi
//  DEĞİLSE, GPU'nun 1600x çarpanı satın alacak bir şey bulamaz.
//
//  ⚠ BU PROJEDE AYNI SINIFTAN İKİ ÖLÇÜM VAR VE İKİSİ DE TAVANI DÜŞÜK BULDU:
//    · beonai: mükemmel seçici bile yalnız +771 (sorun veri değil KARAR UZAYI)
//    · seçici: mükemmel seçici t 0.48/0.70 -> ÇIKMAZ ilan edildi
//  İkisinde de tavan, haftalar harcandıktan SONRA ölçüldü. Bu sefer ÖNCE.
//
//  YÖNTEM: maç kapısı GEREKMEZ. Bir örneklem karar için tüm adaylar oynatılır ve
//  üç seviye karşılaştırılır — hepsi AYNI skor ölçeğinde (rollout skoru):
//    · eleyici #1      : hiç rollout yapmasak (bedava)
//    · en iyi 2 (bugün): LA_DERIN=2 ile seçilen
//    · TAVAN (25)      : gerçek en iyi
//
//  Fark "rollout skoru" biriminde çıkar; maç marjına çevirmez. Ama ORAN anlamlıdır:
//  tavanın ne kadarını bugün zaten alıyoruz?
//
//    node tools/arama-tavani.js --tohum 3 --karar 60
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 3)) || 3);
const TOHUM0 = Number(arg('--tohum0', 660000)) || 660000;
const KARAR = Math.max(5, Number(arg('--karar', 60)) || 60);
const MAX_TIK = Number(arg('--maxtik', 3000)) || 3000;

function kos(ctx, seed) {
    const kod = '(() => {' +
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
        'BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;' +
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;' +
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;' +
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;' +
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true,' +
        '  durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
        'BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;' +
        'const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,' +
        '  brainIntel4:true, isAttacker:false, pro:false });' +
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;' +
        'battleDeployManifest(mv, false, { source:"tavan", ally:true });' +
        'startBattle(); SIM.headless = true;' +
        'LA_AG_ADAY = 0;' +                       // eleyici tüm adayları ağla puanlasın
        'BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false;' +
        'const out = [];' +
        'let st = 0;' +
        'while (SIM.tick < ' + MAX_TIK + ' && phase === PHASE.BATTLE && out.length < ' + KARAR + ') {' +
        '  if (SIM.battle && SIM.battle.winnerSide !== null) break;' +
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
        '  if (SIM.tick % LA_PERIYOT_TIK) continue;' +
        '  const hedefler = SIM.units.filter(u => !u.dead && u.isRed && !u.loaded && !u.abandoned && !u.isAir)' +
        '    .sort((a,b) => (((STATS[b.type]&&STATS[b.type].cost)||0) - ((STATS[a.type]&&STATS[a.type].cost)||0)) || (a.id-b.id))' +
        '    .slice(0, 3);' +
        '  for (const u0 of hedefler) {' +
        '    if (out.length >= ' + KARAR + ') break;' +
        '    const adaylar = battleLookaheadEleVeKapi(u0);' +
        '    if (!adaylar || adaylar.length < 4) continue;' +
        // ── TÜM adayları oynat (gölge: kayıt/telemetri kirlenmesin) ──
        '    const _g = BATTLE_SIM_GOLGE; BATTLE_SIM_GOLGE = true;' +
        '    const fork = battleForkCapture();' +
        '    const bas = battleLookaheadMarj(true);' +
        '    const skorlar = [];' +
        '    for (const a of adaylar) {' +
        '      battleForkRestore(fork);' +
        '      const u = SIM.units.find(x => x.id === u0.id);' +
        '      if (!u) { skorlar.push(null); continue; }' +
        '      u.controlOwner = "PLAYER"; u.manualTarget = null; u.attackTarget = null;' +
        '      u.targetX = a.x; u.targetY = a.y;' +
        '      u.manualMoveTarget = { x: a.x, y: a.y };' +
        '      u.isMovingToManualTarget = true; u._holdingPos = false;' +
        '      let s2 = st;' +
        '      for (let i = 0; i < LA_UFUK && phase === PHASE.BATTLE; i++) {' +
        '        s2 += BATTLE_TICK_MS; stepSim(s2, BATTLE_TICK_SEC, battleControllersDrive, false);' +
        '      }' +
        '      skorlar.push(battleLookaheadSkor(true, bas));' +
        '    }' +
        '    battleForkRestore(fork); BATTLE_SIM_GOLGE = _g;' +
        '    const gecerli = skorlar.map((s,i) => [s,i]).filter(([s]) => s != null && isFinite(s));' +
        '    if (gecerli.length < 4) continue;' +
        // eleyici sırası zaten adaylar[] içinde (skora göre sıralı geldi)
        '    const s0 = skorlar[0];' +                         // eleyici #1'in GERÇEK skoru
        '    const ilk2 = Math.max(skorlar[0], skorlar[1] == null ? -Infinity : skorlar[1]);' +
        '    const tavan = Math.max.apply(null, gecerli.map(([s]) => s));' +
        '    const enKotu = Math.min.apply(null, gecerli.map(([s]) => s));' +
        '    const tavanSira = gecerli.reduce((b,c) => c[0] > b[0] ? c : b)[1];' +
        '    out.push({ tik: SIM.tick, aday: gecerli.length, s0, ilk2, tavan, enKotu, tavanSira });' +
        '  }' +
        '}' +
        'return JSON.stringify({ seed:' + seed + ', out });' +
        '})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'tv-' + seed + '.js' }));
}

function main() {
    const { ctx, hatalar } = tezgahKur();
    if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }
    console.log('ARAMA TAVANI — 25 adayin HEPSINI oynatsak ne kazanirdik?');
    console.log('  ' + N + ' tohum, tohum basi <= ' + KARAR + ' karar');
    console.log('');
    let hepsi = [];
    const t0 = Date.now();
    for (let i = 0; i < N; i++) {
        const r = kos(ctx, TOHUM0 + i);
        hepsi = hepsi.concat(r.out);
        process.stdout.write('  tohum ' + (TOHUM0 + i) + ': +' + r.out.length + '  toplam ' + hepsi.length + '\r');
    }
    console.log(' '.repeat(60));
    if (hepsi.length < 5) { console.log('  karar toplanamadi'); return; }
    const n = hepsi.length;
    const ort = (f) => hepsi.reduce((a, x) => a + f(x), 0) / n;

    /* NORMALİZE FARK: skorlar maç anına göre çok farklı ölçeklerde. Her kararda
       (seçim − en kötü) / (tavan − en kötü) ile 0-1'e çekilir: "bu karar noktasında
       mevcut aralığın ne kadarını alıyoruz". Aralık sıfırsa karar önemsizdir, atılır. */
    const anlamli = hepsi.filter(x => (x.tavan - x.enKotu) > 1e-6);
    const pay = (v, x) => (v - x.enKotu) / (x.tavan - x.enKotu);
    const payEleyici = anlamli.reduce((a, x) => a + pay(x.s0, x), 0) / Math.max(1, anlamli.length);
    const payIlk2 = anlamli.reduce((a, x) => a + pay(x.ilk2, x), 0) / Math.max(1, anlamli.length);

    console.log('  karar: ' + n + '   (yayilimi olan: ' + anlamli.length + ')   aday/karar: ' + ort(x => x.aday).toFixed(1));
    console.log('  sure: ' + ((Date.now() - t0) / 60000).toFixed(1) + 'dk');
    console.log('');
    console.log('  ARALIGIN NE KADARINI ALIYORUZ (0 = en kotu aday, 1 = TAVAN)');
    console.log('    eleyici #1 (hic rollout yok) : ' + (payEleyici * 100).toFixed(1) + '%');
    console.log('    en iyi 2   (BUGUNKU arama)   : ' + (payIlk2 * 100).toFixed(1) + '%');
    console.log('    tavan      (25 adayin hepsi) : 100.0%');
    console.log('');
    console.log('  HAM SKOR (rollout birimi)');
    console.log('    eleyici #1 ' + ort(x => x.s0).toFixed(1) + '   en iyi 2 ' + ort(x => x.ilk2).toFixed(1) +
        '   TAVAN ' + ort(x => x.tavan).toFixed(1) + '   en kotu ' + ort(x => x.enKotu).toFixed(1));
    console.log('    bugunden tavana KALAN: ' + (ort(x => x.tavan) - ort(x => x.ilk2)).toFixed(1) +
        '   (rollout bugun kazandirdigi: ' + (ort(x => x.ilk2) - ort(x => x.s0)).toFixed(1) + ')');
    // TAVAN adayı eleyici siralamasinda KACINCI? Genis arama gerekli mi, yoksa
    // eleyiciyi biraz derinlestirmek yeter mi?
    const sira = {};
    for (const x of anlamli) { const k = x.tavanSira < 5 ? String(x.tavanSira) : '5+'; sira[k] = (sira[k] || 0) + 1; }
    console.log('');
    console.log('  TAVAN ADAYI ELEYICI SIRASINDA KACINCI');
    for (const k of ['0', '1', '2', '3', '4', '5+']) {
        if (!sira[k]) continue;
        console.log('    ' + k.padEnd(3) + ' : ' + String(sira[k]).padStart(4) + '  (%' + (sira[k] / anlamli.length * 100).toFixed(1) + ')');
    }
    console.log('');
    const kalan = (1 - payIlk2) * 100;
    if (kalan < 15) {
        console.log('  ! TAVAN DUSUK: bugunku arama araligin %' + (payIlk2 * 100).toFixed(0) + "'ini zaten aliyor.");
        console.log('    Daha genis arama (GPU) en fazla %' + kalan.toFixed(0) + ' daha getirir -> GPU yolu ZAYIF gerekceli.');
    } else {
        console.log('  TAVAN YUKSEK: geride %' + kalan.toFixed(0) + ' var -> genis arama GERCEKTEN kazandirabilir.');
        console.log('    Bu, GPU/deger-agi yolunun OLCULMUS gerekcesidir.');
    }
}

main();
