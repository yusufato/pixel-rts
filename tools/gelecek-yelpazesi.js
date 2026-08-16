'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  GELECEK YELPAZESİ — "tek gelecek yok, birden çok gelecek var"
//
//  Kullanıcı formülasyonu: A birimi 5sn sonra A1/A2/B1/B2/C1/C2 noktalarında NE OLUR?
//  Aynı soruyu 10sn için de sor. Yani birim başına DALLANAN gelecek.
//
//  BU, PLAN-ZORLAMA DENEYİNDEN FARKLI (tools/arama-denemesi.js):
//  orada üst-seviye plan (MAIN_ATTACK/REGROUP...) zorlanıyordu ve adaylar arasında
//  YAYILIM SIFIR çıktı — plan, planlayıcı önbelleği ve sektör komutası tarafından
//  yutuluyor olabilir. Burada plan katmanı ATLANIR: birime doğrudan gidiş emri verilir.
//  Böylece "seçim gerçekten sonucu değiştiriyor mu" sorusu temiz sorulur.
//
//  YÖNTEM (her ölçüm noktasında, her seçili birim için):
//    1. fork al
//    2. her aday nokta için: restore → birimi o noktaya yolla → oynat
//       → 5sn ve 10sn'de ARA ÖLÇÜM al (aynı rollout iki ufku birden verir)
//    3. adaylar arası YAYILIM = bu seçim ne kadar önemli
//
//  ADAY NOKTALAR: birimin çevresinde yarıçap R'de 6 yön (ileri/geri/sağ/sol/çapraz)
//  + "yerinde kal". Geçilemez araziye düşen aday elenir.
//
//  BİRİM KONTROLÜ: rollout boyunca birim controlOwner=PLAYER yapılır ki AI onu
//  yeniden yönlendirmesin. Bu bir davranış farkı yaratır AMA tüm adaylarda AYNI
//  olduğu için KARŞILAŞTIRMA geçerli kalır (mutlak değerler değil, YAYILIM okunur).
//
//    node tools/gelecek-yelpazesi.js --tohum 3 --birim 3 --yaricap 500
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 3)) || 3);
const TOHUM0 = Number(arg('--tohum0', 100000)) || 100000;
const BIRIM = Math.max(1, Number(arg('--birim', 3)) || 3);        // ölçüm başına kaç birim
const YARICAP = Math.max(100, Number(arg('--yaricap', 500)) || 500);
const ANLAR = (arg('--anlar', '600,1400,2200') || '').split(',').map(Number).filter(Boolean);
const UFUK1 = Math.max(20, Number(arg('--ufuk1', 100)) || 100);   // 5sn
const UFUK2 = Math.max(40, Number(arg('--ufuk2', 200)) || 200);   // 10sn

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
        'battleDeployManifest(mv, false, { source:"yelpaze", ally:true });' +
        'startBattle(); SIM.headless = true;' +
        'const ANLAR = ' + JSON.stringify(ANLAR) + ', BIRIM = ' + BIRIM + ', R = ' + YARICAP + ';' +
        'const U1 = ' + UFUK1 + ', U2 = ' + UFUK2 + ';' +
        'const marj = () => { const a = battleArmyObservation(true), d = battleArmyObservation(false);' +
        '  return a.effectiveValue - d.effectiveValue; };' +
        'const out = []; let st = 0;' +
        'for (const an of ANLAR) {' +
        '  while (SIM.tick < an && phase === PHASE.BATTLE) { st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false); }' +
        '  if (phase !== PHASE.BATTLE) break;' +
        // en DEĞERLİ saldıran birimleri seç (karar kaldıracı en yüksek olanlar)
        '  const adaylar = SIM.units.filter(u => !u.dead && u.isRed && !u.loaded && !u.abandoned)' +
        '    .sort((a, b) => ((STATS[b.type] && STATS[b.type].cost) || 0) - ((STATS[a.type] && STATS[a.type].cost) || 0) || (a.id - b.id))' +
        '    .slice(0, BIRIM).map(u => u.id);' +
        '  const f = battleForkCapture();' +
        '  const basMarj = marj();' +
        '  for (const uid of adaylar) {' +
        '    const u0 = SIM.units.find(x => x.id === uid); if (!u0) continue;' +
        '    const bx = u0.x, by = u0.y;' +
        // 6 yön + yerinde kal; geçilemez arazi elenir
        '    const noktalar = [{ ad:"KAL", x:bx, y:by }];' +
        '    for (let k = 0; k < 6; k++) {' +
        '      const a2 = (Math.PI * 2 * k) / 6;' +
        '      const px = bx + Math.cos(a2) * R, py = by + Math.sin(a2) * R;' +
        '      if (px < 60 || py < 60 || px > WORLD_W - 60 || py > WORLD_H - 60) continue;' +
        '      if (typeof isPassableAt === "function" && !isPassableAt(px, py)) continue;' +
        '      noktalar.push({ ad: "Y" + k, x: px, y: py });' +
        '    }' +
        '    if (noktalar.length < 3) continue;' +
        '    const skor = [];' +
        '    for (const nk of noktalar) {' +
        '      battleForkRestore(f);' +
        '      const u = SIM.units.find(x => x.id === uid); if (!u) continue;' +
        // AI bu birimi yeniden yönlendirmesin: rollout boyunca oyuncu-kontrolü
        '      u.controlOwner = "PLAYER";' +
        '      u.manualTarget = null; u.attackTarget = null;' +
        '      u.targetX = nk.x; u.targetY = nk.y;' +
        '      u.manualMoveTarget = { x: nk.x, y: nk.y }; u.isMovingToManualTarget = true;' +
        '      u._holdingPos = false;' +
        '      const hp0 = u.hp;' +
        '      let s2 = st, m1 = null, hp1 = null, sag1 = null;' +
        '      for (let i = 0; i < U2 && phase === PHASE.BATTLE; i++) {' +
        '        s2 += BATTLE_TICK_MS; stepSim(s2, BATTLE_TICK_SEC, battleControllersDrive, false);' +
        '        if (i === U1 - 1) { const uu = SIM.units.find(x => x.id === uid);' +
        '          m1 = Math.round(marj() - basMarj); hp1 = uu ? Math.round(uu.hp) : 0; sag1 = !!(uu && !uu.dead); }' +
        '      }' +
        '      const uu2 = SIM.units.find(x => x.id === uid);' +
        '      skor.push({ nokta: nk.ad, marj5: m1, marj10: Math.round(marj() - basMarj),' +
        '        hp5: hp1, hp10: uu2 ? Math.round(uu2.hp) : 0, hp0: Math.round(hp0),' +
        '        sag5: sag1, sag10: !!(uu2 && !uu2.dead) });' +
        '    }' +
        '    battleForkRestore(f);' +
        '    const g = k => skor.map(s3 => s3[k]).filter(v => v != null);' +
        '    const yay = k => { const v = g(k); return v.length ? Math.max(...v) - Math.min(...v) : 0; };' +
        '    out.push({ tik: an, birim: uid, tip: (STATS[u0.type] && STATS[u0.type].id) || u0.type,' +
        '      aday: skor.length, yayilimMarj5: yay("marj5"), yayilimMarj10: yay("marj10"),' +
        '      yayilimHp10: yay("hp10"), olumVar: skor.some(s3 => !s3.sag10) && skor.some(s3 => s3.sag10),' +
        '      skor: skor });' +
        '  }' +
        '}' +
        'return JSON.stringify({ seed: ' + seed + ', olcumler: out });' +
        '})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'yelpaze-' + seed + '.js' }));
}

function main() {
    const { ctx, hatalar } = tezgahKur();
    if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }

    const hepsi = [];
    for (let i = 0; i < N; i++) {
        hepsi.push(...kos(ctx, TOHUM0 + i).olcumler);
        process.stdout.write('  tohum ' + (i + 1) + '/' + N + '  olcum ' + hepsi.length + '\r');
    }
    console.log(' '.repeat(44) + '\r');
    if (!hepsi.length) { console.log('OLCUM YOK'); return; }

    const ort = k => hepsi.reduce((a, x) => a + x[k], 0) / hepsi.length;
    const sifirYayilim = hepsi.filter(x => x.yayilimMarj10 === 0).length;
    const olumFarki = hepsi.filter(x => x.olumVar).length;

    console.log('GELECEK YELPAZESI — ' + N + ' tohum, ' + hepsi.length + ' olcum (birim x an)');
    console.log('  aday nokta/birim ort : ' + ort('aday').toFixed(1) + '   (yerinde-kal + 6 yon, arazi suzgecli)');
    console.log('');
    console.log('  YAYILIM = en iyi aday ile en kotu aday arasindaki fark. Sifirsa SECIM ONEMSIZ.');
    console.log('    marj  @5sn  : ' + Math.round(ort('yayilimMarj5')));
    console.log('    marj  @10sn : ' + Math.round(ort('yayilimMarj10')));
    console.log('    birim hp@10sn: ' + Math.round(ort('yayilimHp10')));
    console.log('');
    console.log('  yayilimi SIFIR olan olcum : ' + sifirYayilim + '/' + hepsi.length +
        ' = %' + (sifirYayilim / hepsi.length * 100).toFixed(1));
    console.log('  bazi noktada OLUP bazisinda SAG kalan birim : ' + olumFarki + '/' + hepsi.length +
        ' = %' + (olumFarki / hepsi.length * 100).toFixed(1) + '   (gidilen nokta OLUM-KALIM belirliyor)');

    if (process.argv.includes('--ham')) {
        console.log('');
        for (const o of hepsi.slice(0, 3)) {
            console.log('  ' + o.tip + ' #' + o.birim + ' @tik' + o.tik + ':');
            for (const s of o.skor) console.log('    ' + String(s.nokta).padEnd(5) +
                ' marj5 ' + String(s.marj5).padStart(6) + '  marj10 ' + String(s.marj10).padStart(6) +
                '  hp ' + String(s.hp0).padStart(4) + '->' + String(s.hp10).padStart(4) + (s.sag10 ? '' : '  OLDU'));
        }
    }
}

main();
