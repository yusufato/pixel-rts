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
//  ÖLÇÜLEN DOYMA EĞRİSİ (2 tohum, 17 ölçüm, ufuk 10sn):
//    aday   yayılım@10sn   KAZANÇ (en iyi − "yerinde kal")   t
//     6.6       227              +116                       3.02
//    12.6       316              +118                       3.06
//    23.6       354              +146                       3.04   <-- DOYMA
//    31.0       345              +136                       2.98
//    47.0       374              +152                       3.25
//  ~24 adaydan sonra kazanç artmıyor (146/136/152 gürültü içinde; std ~190, n=17).
//  Aday sayısını 24'ten 47'ye çıkarmak maliyeti 2 katına çıkarıp KAZANÇ getirmiyor.
//
//  AYRICA: yön sayısını artırmak işe YARAMIYOR (6.6→12.6 aday = +2 kazanç),
//  halka (mesafe) eklemek YARIYOR (12.6→23.6 = +28). Karar "ne tarafa" değil
//  "NE KADAR UZAĞA". Gerçek arama tasarlanırken adaylar açıya değil MENZİLE yayılmalı.
//
//  MALİYET: 1 aday ≈ 203ms (10sn ufuk) → 24 aday ≈ 4.9sn (TEK birimin TEK kararı).
//  Canlı oyun için fazla; değer ağı (ρ 0.830) kaba eleme yapıp yalnız hayatta kalan
//  3-5 adayı gerçekten oynatmalı.
//
//  ON ELEME — IKI OLCUT KARSILASTIRILDI (korunan kazanc, K = derin oynatilan aday):
//                            K=3    K=4    K=6    K=8
//    1sn'lik ucuz rollout    %27    %38    %73    %84
//    ANALITIK (oynatmadan)   %72    %73    %73    %82
//
//  ANALITIK SKOR KAZANDI ve BEDAVA. 1sn rollout kotu bir yordayici cunku bir mevzinin
//  degeri ZAMANLA ortaya cikiyor; ilk saniye onu goremiyor. Basit "ben onlari vururum,
//  onlar beni vuramaz" hesabi ise dogru adayi ilk 3'e neredeyse hep sokuyor.
//
//  PRATIK TARIF (olculen):
//    24 aday (MENZILE yayilmis) -> analitik skorla ilk 3 -> yalniz o 3'u 10sn oynat
//    maliyet: 24 x ~0 + 3 x 203ms = 609ms   (tam tarama 4.9sn -> 8 KAT ucuz)
//    korunan kazanc: %72  ->  ~105 marj / birim-karari
//
//  Yani DEGER AGI SART DEGIL. Egitilmis ag (ro 0.830) daha iyi eleyebilir ama motora
//  bagli degil ve eski motorda egitilmis (veri bayat). Analitik eleyici o kopruyu
//  BEKLEMEDEN aramanin canliya baglanmasina yetiyor.
//
//    node tools/gelecek-yelpazesi.js --tohum 3 --birim 3 --yaricap 600 --yon 12 --halka 2
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 3)) || 3);
const TOHUM0 = Number(arg('--tohum0', 100000)) || 100000;
const BIRIM = Math.max(1, Number(arg('--birim', 3)) || 3);        // ölçüm başına kaç birim
const YARICAP = Math.max(100, Number(arg('--yaricap', 500)) || 500);
// DALLANMAYI BUYUT: yon sayisi x halka sayisi. Aday = 1 (KAL) + YON*HALKA.
const YON = Math.max(3, Number(arg('--yon', 6)) || 6);
const HALKA = Math.max(1, Number(arg('--halka', 1)) || 1);
const ANLAR = (arg('--anlar', '600,1400,2200') || '').split(',').map(Number).filter(Boolean);
const UFUK0 = Math.max(5, Number(arg('--ufuk0', 20)) || 20);      // 1sn — UCUZ ON ELEME
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
        'const YON = ' + YON + ', HALKA = ' + HALKA + ';' +
        'const U0 = ' + UFUK0 + ', U1 = ' + UFUK1 + ', U2 = ' + UFUK2 + ';' +
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
        '    for (let h = 1; h <= HALKA; h++) {' +
        '      const rr = R * h / HALKA;' +
        '      for (let k = 0; k < YON; k++) {' +
        '        const a2 = (Math.PI * 2 * k) / YON + (h % 2 ? 0 : Math.PI / YON);' +   // halkalar kaydirmali
        '        const px = bx + Math.cos(a2) * rr, py = by + Math.sin(a2) * rr;' +
        '        if (px < 60 || py < 60 || px > WORLD_W - 60 || py > WORLD_H - 60) continue;' +
        '        if (typeof isPassableAt === "function" && !isPassableAt(px, py)) continue;' +
        '        noktalar.push({ ad: "H" + h + "Y" + k, x: px, y: py });' +
        '      }' +
        '    }' +
        '    if (noktalar.length < 3) continue;' +
        '    const skor = [];' +
        /* ANALITIK SKOR — adayi HIC OYNATMADAN puanla (mikrosaniye).
           Fikir: iyi mevzi = ben onlari vurabiliyorum, onlar beni vuramiyor.
             +  o noktadan MENZILIME giren dusman degeri   (firsat)
             -  o noktayi KENDI menziline alan dusman degeri x2  (maruziyet)
             +  yakin dost destegi (yalniz kalma cezasi)
           Deger agi olmadan eleme yapabilir miyiz sorusunun ucuz cevabi. */
        '    const statik = (px, py) => {' +
        '      const benim = STATS[u0.type] ? (STATS[u0.type].range || 0) : 0;' +
        '      let firsat = 0, maruz = 0, dost = 0;' +
        '      for (const o of SIM.units) {' +
        '        if (o.dead || o.loaded || o.abandoned) continue;' +
        '        const d = Math.hypot(o.x - px, o.y - py);' +
        '        const c = (STATS[o.type] && STATS[o.type].cost) || 0;' +
        '        if (o.isRed === u0.isRed) { if (o.id !== uid && d < 700) dost += c * (1 - d / 700); continue; }' +
        '        if (d <= benim) firsat += c;' +
        '        const onun = STATS[o.type] ? (STATS[o.type].range || 0) : 0;' +
        '        if (d <= onun) maruz += c;' +
        '      }' +
        '      return Math.round(firsat - maruz * 2 + dost * 0.15);' +
        '    };' +
        '    for (const nk of noktalar) {' +
        '      const sk = statik(nk.x, nk.y);' +
        '      battleForkRestore(f);' +
        '      const u = SIM.units.find(x => x.id === uid); if (!u) continue;' +
        // AI bu birimi yeniden yönlendirmesin: rollout boyunca oyuncu-kontrolü
        '      u.controlOwner = "PLAYER";' +
        '      u.manualTarget = null; u.attackTarget = null;' +
        '      u.targetX = nk.x; u.targetY = nk.y;' +
        '      u.manualMoveTarget = { x: nk.x, y: nk.y }; u.isMovingToManualTarget = true;' +
        '      u._holdingPos = false;' +
        '      const hp0 = u.hp;' +
        '      let s2 = st, m0 = null, m1 = null, hp1 = null, sag1 = null;' +
        '      for (let i = 0; i < U2 && phase === PHASE.BATTLE; i++) {' +
        '        s2 += BATTLE_TICK_MS; stepSim(s2, BATTLE_TICK_SEC, battleControllersDrive, false);' +
        '        if (i === U0 - 1) m0 = Math.round(marj() - basMarj);' +
        '        if (i === U1 - 1) { const uu = SIM.units.find(x => x.id === uid);' +
        '          m1 = Math.round(marj() - basMarj); hp1 = uu ? Math.round(uu.hp) : 0; sag1 = !!(uu && !uu.dead); }' +
        '      }' +
        '      const uu2 = SIM.units.find(x => x.id === uid);' +
        '      skor.push({ nokta: nk.ad, statik: sk, marj1: m0, marj5: m1, marj10: Math.round(marj() - basMarj),' +
        '        hp5: hp1, hp10: uu2 ? Math.round(uu2.hp) : 0, hp0: Math.round(hp0),' +
        '        sag5: sag1, sag10: !!(uu2 && !uu2.dead) });' +
        '    }' +
        '    battleForkRestore(f);' +
        '    const g = k => skor.map(s3 => s3[k]).filter(v => v != null);' +
        '    const yay = k => { const v = g(k); return v.length ? Math.max(...v) - Math.min(...v) : 0; };' +
        '    const kal = skor.find(s3 => s3.nokta === "KAL");' +
        '    const enIyi10 = Math.max.apply(null, g("marj10"));' +
        '    out.push({ tik: an, birim: uid, tip: (STATS[u0.type] && STATS[u0.type].id) || u0.type,' +
        '      enIyi10: enIyi10, kal10: kal ? kal.marj10 : null,' +
        '      kazanc: kal ? (enIyi10 - kal.marj10) : null,' +
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
    // ASIL KARAR OLCUSU: en iyi adayin "yerinde kal"a gore kazandirdigi marj.
    // Yayilim "secim onemli mi" der; KAZANC "aramak ne kadar ISE YARAR" der.
    /* IKI ASAMALI ELEME (modelsiz): once 1sn'lik UCUZ rollout ile sirala, yalniz ilk K
       adayi 10sn oynat. Ayni rollout'un ara olcumleri kullanildigi icin bu simulasyon
       EK MALIYET GEREKTIRMEZ ve gercek iki-asamali aramayla birebir ayni sonucu verir. */
    for (const [ad, anahtar] of [['1sn rollout', 'marj1'], ['ANALITIK (oynatmadan)', 'statik']]) {
        const satir = [];
        for (const K of [3, 4, 6, 8]) {
            let toplamTam = 0, toplamElemeli = 0, n2 = 0;
            for (const o of hepsi) {
                const kal = o.skor.find(s3 => s3.nokta === 'KAL'); if (!kal) continue;
                const gecerli = o.skor.filter(s3 => s3[anahtar] != null);
                if (gecerli.length <= K) continue;
                const tamEnIyi = Math.max(...o.skor.map(s3 => s3.marj10));
                const secilen = gecerli.slice().sort((a, b) => b[anahtar] - a[anahtar]).slice(0, K);
                toplamTam += tamEnIyi - kal.marj10;
                toplamElemeli += Math.max(...secilen.map(s3 => s3.marj10)) - kal.marj10;
                n2++;
            }
            if (n2) satir.push('K=' + K + ' %' + (toplamTam !== 0 ? (toplamElemeli / toplamTam * 100).toFixed(0) : '0'));
        }
        console.log('  ELEME [' + ad + ']: ' + satir.join('   '));
    }
    const kz = hepsi.filter(x => x.kazanc != null).map(x => x.kazanc);
    if (kz.length) {
        const ok = kz.reduce((a, b) => a + b, 0) / kz.length;
        const sd = Math.sqrt(kz.reduce((a, b) => a + (b - ok) ** 2, 0) / Math.max(1, kz.length - 1));
        console.log('');
        console.log('  KAZANC (en iyi aday - "yerinde kal") @10sn : ' + Math.round(ok) +
            '  std ' + Math.round(sd) + '  t ' + (ok / (sd / Math.sqrt(kz.length))).toFixed(2));
    }

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
