'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  HEDEF KARARLILIĞI — hangi ölçü ufuk uzayınca hayatta kalıyor?
//
//  KÖK BULGU (tools/gelecek-yelpazesi.js): 10sn'de en iyi çıkan aday, 20sn'de
//  kazancın yalnızca %13'ünü koruyor. Yani argmax(global marj) KALICI üstünlük
//  değil GEÇİCİ takas seçiyor — ve bu, beş null A/B sonucunu tek başına açıklıyor.
//
//  BU ARAÇ ŞUNU SORAR: kısa ufukta ölçtüğümüz HANGİ büyüklük, uzun ufukta da
//  geçerli kalıyor? Yani AI'ya "geleceğe bakarken NEYE bak" demeliyiz?
//
//  Kullanıcının önerdiği girdiler ölçü adayı olarak sınanır:
//    · kiminle karşı karşıya gelecek  → maruziyet (menzili beni kapsayan düşman ₺)
//    · ne kadar atış yapabilir        → fırsat (menzilime giren düşman ₺)
//    · canı ne olur                   → hp / sağ kalma
//    · dostlar nerede                 → yakın dost ₺, yerel kuvvet oranı
//    · global sonuç                   → marj (mevcut hedef, taban)
//
//  YÖNTEM: her aday KISA ufukta puanlanır, sonra UZUN ufka kadar oynatılır.
//  "Kısa ufukta X'e göre en iyi olanı seçseydim, uzun ufukta ne kazanırdım?"
//  Referans: uzun ufukta gerçekten en iyi olan aday (oracle).
//
//    node tools/hedef-kararliligi.js --tohum 2 --birim 2 --kisa 200 --uzun 800
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 2)) || 2);
const TOHUM0 = Number(arg('--tohum0', 100000)) || 100000;
const BIRIM = Math.max(1, Number(arg('--birim', 2)) || 2);
const KISA = Math.max(20, Number(arg('--kisa', 200)) || 200);    // 10sn
const UZUN = Math.max(200, Number(arg('--uzun', 800)) || 800);   // 40sn
const YON = Math.max(3, Number(arg('--yon', 6)) || 6);
const HALKA = Math.max(1, Number(arg('--halka', 2)) || 2);
const ANLAR = (arg('--anlar', '700,1500,2300') || '').split(',').map(Number).filter(Boolean);

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
        'battleDeployManifest(mv, false, { source:"hk", ally:true });' +
        'startBattle(); SIM.headless = true;' +
        'const ANLAR = ' + JSON.stringify(ANLAR) + ', BIRIM = ' + BIRIM + ';' +
        'const KISA = ' + KISA + ', UZUN = ' + UZUN + ', YON = ' + YON + ', HALKA = ' + HALKA + ';' +
        'const marj = () => { const a = battleArmyObservation(true), d = battleArmyObservation(false);' +
        '  return a.effectiveValue - d.effectiveValue; };' +
        // ── ÖLÇÜ ADAYLARI: birimin O ANDAKİ durumundan okunur (rollout gerektirmez) ──
        'const olcu = (uid) => {' +
        '  const u = SIM.units.find(x => x.id === uid);' +
        '  if (!u || u.dead) return { sag:0, hp:0, firsat:0, maruz:0, dost:0, yerel:0, guvenli:0 };' +
        '  const benim = STATS[u.type] ? (STATS[u.type].range || 0) : 0;' +
        '  let firsat = 0, maruz = 0, dost = 0, dus = 0;' +
        '  for (const o of SIM.units) {' +
        '    if (o.dead || o.loaded || o.abandoned || o.id === uid) continue;' +
        '    const d = Math.hypot(o.x - u.x, o.y - u.y);' +
        '    const c = (STATS[o.type] && STATS[o.type].cost) || 0;' +
        '    if (o.isRed === u.isRed) { if (d < 900) dost += c; continue; }' +
        '    if (d < 900) dus += c;' +
        '    if (d <= benim) firsat += c;' +
        '    const onun = STATS[o.type] ? (STATS[o.type].range || 0) : 0;' +
        '    if (d <= onun) maruz += c;' +
        '  }' +
        '  return { sag: 1, hp: u.hp, firsat: firsat, maruz: maruz, dost: dost,' +
        '    yerel: dus > 0 ? dost / dus : 3, guvenli: firsat - maruz };' +
        '};' +
        'const out = []; let st = 0;' +
        'for (const an of ANLAR) {' +
        '  while (SIM.tick < an && phase === PHASE.BATTLE) { st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false); }' +
        '  if (phase !== PHASE.BATTLE) break;' +
        '  const hedefler = SIM.units.filter(u => !u.dead && u.isRed && !u.loaded && !u.abandoned && !u.isAir)' +
        '    .sort((a, b) => (((STATS[b.type] && STATS[b.type].cost) || 0) - ((STATS[a.type] && STATS[a.type].cost) || 0)) || (a.id - b.id))' +
        '    .slice(0, BIRIM).map(u => u.id);' +
        '  const f = battleForkCapture();' +
        '  const basMarj = marj();' +
        '  for (const uid of hedefler) {' +
        '    const u0 = SIM.units.find(x => x.id === uid); if (!u0) continue;' +
        '    const noktalar = [{ ad:"KAL", x:u0.x, y:u0.y }];' +
        '    for (let h = 1; h <= HALKA; h++) { const rr = 600 * h / HALKA;' +
        '      for (let k = 0; k < YON; k++) { const a2 = (Math.PI*2*k)/YON + (h%2?0:Math.PI/YON);' +
        '        const px = u0.x + Math.cos(a2)*rr, py = u0.y + Math.sin(a2)*rr;' +
        '        if (px<60||py<60||px>WORLD_W-60||py>WORLD_H-60) continue;' +
        '        if (typeof isPassableAt === "function" && !isPassableAt(px,py)) continue;' +
        '        noktalar.push({ ad:"H"+h+"Y"+k, x:px, y:py }); } }' +
        '    if (noktalar.length < 4) continue;' +
        '    const skor = [];' +
        '    for (const nk of noktalar) {' +
        '      battleForkRestore(f);' +
        '      const u = SIM.units.find(x => x.id === uid); if (!u) continue;' +
        '      u.controlOwner = "PLAYER"; u.manualTarget = null; u.attackTarget = null;' +
        '      u.targetX = nk.x; u.targetY = nk.y;' +
        '      u.manualMoveTarget = { x: nk.x, y: nk.y }; u.isMovingToManualTarget = true; u._holdingPos = false;' +
        '      let s2 = st, kisaOlcu = null, kisaMarj = null;' +
        '      for (let i = 0; i < UZUN && phase === PHASE.BATTLE; i++) {' +
        '        s2 += BATTLE_TICK_MS; stepSim(s2, BATTLE_TICK_SEC, battleControllersDrive, false);' +
        '        if (i === KISA - 1) { kisaOlcu = olcu(uid); kisaMarj = marj() - basMarj; }' +
        '      }' +
        '      skor.push({ nokta: nk.ad, kisa: kisaOlcu, kisaMarj: Math.round(kisaMarj),' +
        '        uzunMarj: Math.round(marj() - basMarj), uzun: olcu(uid) });' +
        '    }' +
        '    battleForkRestore(f);' +
        '    out.push({ tik: an, birim: uid, tip: (STATS[u0.type] && STATS[u0.type].id) || u0.type, skor: skor });' +
        '  }' +
        '}' +
        'return JSON.stringify({ seed: ' + seed + ', olcumler: out });' +
        '})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'hk-' + seed + '.js' }));
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

    // KISA ufukta X'e göre seç → UZUN ufuktaki GLOBAL MARJI ne kadar kazanırdın?
    const KURALLAR = [
        ['global marj',      s => s.kisaMarj],
        ['birim SAG',        s => s.kisa.sag * 1e6 + s.kisa.hp],
        ['birim CAN',        s => s.kisa.hp],
        ['FIRSAT (atabilir)',s => s.kisa.firsat],
        ['MARUZ (dusuk iyi)',s => -s.kisa.maruz],
        ['GUVENLI (firsat-maruz)', s => s.kisa.guvenli],
        ['YEREL ORAN',       s => s.kisa.yerel],
        ['DOST YAKIN',       s => s.kisa.dost]
    ];

    console.log('HEDEF KARARLILIGI — ' + N + ' tohum, ' + hepsi.length + ' olcum');
    console.log('  kisa ufuk ' + Math.round(KISA * 0.05) + 'sn -> uzun ufuk ' + Math.round(UZUN * 0.05) + 'sn');
    console.log('');
    console.log('  KISA ufukta su olcuye gore sec, UZUN ufuktaki marji al:');
    console.log('    ' + 'olcu'.padEnd(24) + 'ayni aday'.padStart(10) + 'korunan kazanc'.padStart(16));
    console.log('    ' + '-'.repeat(50));
    for (const [ad, fn] of KURALLAR) {
        let ayni = 0, n2 = 0, korunan = 0, toplam = 0;
        for (const o of hepsi) {
            const kal = o.skor.find(s => s.nokta === 'KAL'); if (!kal) continue;
            if (o.skor.length < 4) continue;
            const secilen = o.skor.slice().sort((a, b) => fn(b) - fn(a))[0];
            const oracle = o.skor.slice().sort((a, b) => b.uzunMarj - a.uzunMarj)[0];
            if (secilen.nokta === oracle.nokta) ayni++;
            korunan += secilen.uzunMarj - kal.uzunMarj;
            toplam += oracle.uzunMarj - kal.uzunMarj;
            n2++;
        }
        if (!n2) continue;
        const oran = toplam !== 0 ? (korunan / toplam * 100) : 0;
        console.log('    ' + ad.padEnd(24) + ('%' + (ayni / n2 * 100).toFixed(0)).padStart(10) +
            ('%' + oran.toFixed(0)).padStart(16));
    }
    console.log('');
    console.log('  ORACLE = uzun ufukta gercekten en iyi olan aday (tavan).');
    console.log('  "korunan kazanc" %100 ise o olcu tavani yakaliyor, %0 ise "yerinde kal" kadar.');
}

main();
