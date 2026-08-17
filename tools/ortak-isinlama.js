'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  ORTAK IŞINLAMA — "25 kendi konumu × 25 düşman hareketi, hepsi değer ağıyla"
//
//  KULLANICI FİKRİ: simülasyonu değil DEĞERLENDİRMEYİ çoğalt. Birimi 25 aday
//  noktaya, düşmanı 25 aday noktaya ışınla, 625 durumu ağa sor, en-kötü-duruma
//  göre seç. Bu iş GPU'nun tam şekli (dallanma yok, tek batch).
//
//  ═══ ÖNCE SİNYAL, SONRA GPU ═══
//  WebGPU portu ciddi iş (WGSL + iki uygulamanın bit-eşitliği). Ama fikrin
//  DEĞERLİ olup olmadığı CPU'da bugün ölçülebilir: 625 değerlendirme yavaş ama
//  offline koşulabilir. Sinyal yoksa haftalarca sürecek port boşa gider.
//
//  ÖLÇÜLEN SORU: ortak ışınlama, GERÇEK rollout'un seçtiği adayı tek taraflı
//  ışınlamadan daha sık buluyor mu?
//    · rollout = yer gerçeği (birim gerçekten yürüdü, düşman gerçekten tepki verdi)
//    · tek taraflı ışınlama = bugünkü eleyici. ÖLÇÜLDÜ: rollout bunu %62.6 deviriyor.
//    · ortak ışınlama = kullanıcının önerisi, HİÇ denenmedi
//
//  ⚠ DAĞILIM RİSKİ: değer ağı GERÇEK maç durumlarında eğitildi. Düşman birimini
//  kafes noktasına ışınlamak, ağın hiç görmediği durumlar üretir. Bugün tam bu
//  sınıftan bir hata yaşandı (politika, eğitildiğinden farklı seçim kümesinde çöktü).
//  Bu yüzden "mantıklı görünüyor" yetmez; sayı gerekir.
//
//    node tools/ortak-isinlama.js --tohum 3 --karar 120
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 3)) || 3);
const TOHUM0 = Number(arg('--tohum0', 610000)) || 610000;
const KARAR = Math.max(10, Number(arg('--karar', 120)) || 120);   // kaç karar örneklensin
const MAX_TIK = Number(arg('--maxtik', 2400)) || 2400;

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
        'battleDeployManifest(mv, false, { source:"ortak", ally:true });' +
        'startBattle(); SIM.headless = true;' +
        'LA_AG_ADAY = 0;' +            // eleyici TÜM adayları ağla puanlasın (karşılaştırma adil olsun)
        'const sonuc = [];' +
        'let st = 0;' +
        'while (SIM.tick < ' + MAX_TIK + ' && phase === PHASE.BATTLE && sonuc.length < ' + KARAR + ') {' +
        '  if (SIM.battle && SIM.battle.winnerSide !== null) break;' +
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
        '  if (SIM.tick % LA_PERIYOT_TIK) continue;' +
        // ── bu turda kırmızının en değerli birimleri ──
        '  const hedefler = SIM.units.filter(u => !u.dead && u.isRed && !u.loaded && !u.abandoned && !u.isAir)' +
        '    .sort((a,b) => (((STATS[b.type]&&STATS[b.type].cost)||0) - ((STATS[a.type]&&STATS[a.type].cost)||0)) || (a.id-b.id))' +
        '    .slice(0, 4);' +
        '  for (const u0 of hedefler) {' +
        '    if (sonuc.length >= ' + KARAR + ') break;' +
        '    const adaylar = battleLookaheadEleVeKapi(u0);' +
        '    if (!adaylar || adaylar.length < 3) continue;' +
        // ── (1) TEK TARAFLI IŞINLAMA: bugünkü eleyicinin sıralaması (_ag) ──
        '    const tekSira = adaylar.slice().sort((a,b) => (b._ag - a._ag) || (a.x-b.x) || (a.y-b.y));' +
        '    const tekEnIyi = tekSira[0];' +
        // ── (2) ORTAK IŞINLAMA: en yakın DÜŞMAN birimi de 25 noktaya ışınlanır ──
        '    let dus = null, dd = 1e9;' +
        '    for (const o of SIM.units) {' +
        '      if (o.dead || o.abandoned || o.loaded || o.isRed === u0.isRed || o.isAir) continue;' +
        '      const d = Math.hypot(o.x-u0.x, o.y-u0.y);' +
        '      if (d < dd) { dd = d; dus = o; }' +
        '    }' +
        '    if (!dus) continue;' +
        '    const dusAday = battleLookaheadAdaylar(dus);' +
        '    let ortakEnIyi = null, ortakEnIyiSkor = -Infinity, cagri = 0;' +
        '    const ux = u0.x, uy = u0.y, dx0 = dus.x, dy0 = dus.y;' +
        '    for (const a of adaylar) {' +
        '      let enKotu = Infinity;' +   // düşmanın EN İYİ cevabına göre (minimax)
        '      u0.x = a.x; u0.y = a.y;' +
        '      for (const b of dusAday) {' +
        '        dus.x = b.x; dus.y = b.y;' +
        '        const v = battleValueNetDurum(); cagri++;' +
        '        if (v == null || !isFinite(v)) continue;' +
        '        const s = u0.isRed ? v : -v;' +
        '        if (s < enKotu) enKotu = s;' +
        '      }' +
        '      if (enKotu > ortakEnIyiSkor) { ortakEnIyiSkor = enKotu; ortakEnIyi = a; }' +
        '    }' +
        '    u0.x = ux; u0.y = uy; dus.x = dx0; dus.y = dy0;' +
        '    if (!ortakEnIyi) continue;' +
        // ── (3) YER GERÇEĞİ: gerçek rollout ne seçti ──
        '    const k = battleLookaheadBirimKarari(u0.id, true, st);' +
        '    const gercekSinif = k ? (function(){' +
        '      let en = null, ed = 1e9;' +
        '      for (const a of adaylar) { const d = Math.hypot(a.x-k.x, a.y-k.y); if (d < ed) { ed = d; en = a; } }' +
        '      return en ? (en.sinif|0) : -1; })() : 0;' +
        '    sonuc.push({ tik: SIM.tick, tek: tekEnIyi.sinif|0, ortak: ortakEnIyi.sinif|0,' +
        '      gercek: gercekSinif, cagri, aday: adaylar.length, dusAday: dusAday.length });' +
        '  }' +
        '}' +
        'return JSON.stringify({ seed:' + seed + ', sonuc });' +
        '})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'oi-' + seed + '.js' }));
}

function main() {
    const { ctx, hatalar } = tezgahKur();
    if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }
    console.log('ORTAK ISINLAMA — kullanicinin 25x25 fikrinin SINYAL testi');
    console.log('  ' + N + ' tohum, tohum basi <= ' + KARAR + ' karar');
    console.log('');
    let hepsi = [];
    for (let i = 0; i < N; i++) {
        const r = kos(ctx, TOHUM0 + i);
        hepsi = hepsi.concat(r.sonuc);
        process.stdout.write('  tohum ' + (TOHUM0 + i) + ': ' + r.sonuc.length + ' karar   toplam ' + hepsi.length + '\r');
    }
    console.log(' '.repeat(60));
    if (!hepsi.length) { console.log('  karar toplanamadi'); return; }

    const tekIsabet = hepsi.filter(x => x.tek === x.gercek).length;
    const ortakIsabet = hepsi.filter(x => x.ortak === x.gercek).length;
    const ayni = hepsi.filter(x => x.tek === x.ortak).length;
    const n = hepsi.length;
    const ortCagri = Math.round(hepsi.reduce((a, x) => a + x.cagri, 0) / n);

    console.log('  karar sayisi: ' + n + '   ortalama ag cagrisi/karar: ' + ortCagri +
        '   (aday ' + hepsi[0].aday + ' x dusman ' + hepsi[0].dusAday + ')');
    console.log('');
    console.log('  ROLLOUT (yer gercegi) ile ORTUSME');
    console.log('    tek tarafli isinlama (bugunku eleyici) : %' + (tekIsabet / n * 100).toFixed(1));
    console.log('    ORTAK isinlama (25x25, en-kotu-durum)  : %' + (ortakIsabet / n * 100).toFixed(1));
    console.log('    iki yontem birbiriyle ayni             : %' + (ayni / n * 100).toFixed(1));
    console.log('');
    // Esleştirilmiş isaret testi: ortak, tekin YANILDIGI yerlerde ne kadar duzeltiyor?
    const duzeltti = hepsi.filter(x => x.tek !== x.gercek && x.ortak === x.gercek).length;
    const bozdu = hepsi.filter(x => x.tek === x.gercek && x.ortak !== x.gercek).length;
    console.log('  ORTAK ISINLAMANIN NET KATKISI');
    console.log('    tek yanilirken ortak DUZELTTI : ' + duzeltti);
    console.log('    tek dogruyken ortak BOZDU     : ' + bozdu);
    const net = duzeltti - bozdu;
    // McNemar isaret testi (yaklasik z)
    const z = (duzeltti + bozdu) > 0 ? (duzeltti - bozdu) / Math.sqrt(duzeltti + bozdu) : 0;
    console.log('    NET: ' + (net >= 0 ? '+' : '') + net + '   z ' + z.toFixed(2) +
        (Math.abs(z) >= 2 ? (net > 0 ? '  -> ORTAK ANLAMLI IYI' : '  -> ORTAK ANLAMLI KOTU') : '  -> anlamli fark YOK'));
    console.log('');
    console.log('  KARAR: ortak isinlama tek tarafliyi ANLAMLI gecmiyorsa, GPU portu');
    console.log('         gerekcelendirilemez — 625 degerlendirme hizlansa da yanlis');
    console.log('         cevabi hizli vermis oluruz.');
}

main();
