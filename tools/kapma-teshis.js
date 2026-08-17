'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  KAPMA TEŞHİSİ — "istihkâm beyaz bayrak çekmiş araca ölümüne yürüyor"
//
//  KULLANICI SAHADA GÖRDÜ. Kök neden (js/Unit.js updateEngineerAI): ele geçirme bloğu
//  KOŞULSUZ ÖNCELİKti ve `return` ile çıkıyordu → aynı fonksiyonda 20 satır aşağıdaki
//  `closeThreat` kontrolüne (kendi çevresinde 360px düşman) HİÇ ulaşmıyordu. Üstelik
//  arama yarıçapı 1300px: haritanın yarısındaki enkaz için düşman ateşine yürüyordu.
//
//  NEDEN MAÇ KAPISI DEĞİL: bu tek bir birim tipinin davranışı. Maç marjı std ≈ 2770;
//  bir istihkâmın hayatta kalması o gürültünün çok altında kalır ve kapı hiçbir şey
//  göremez. Beceri katmanları turunda öğrenildi: MEKANİZMA metriği gürültüsüzdür,
//  maç kapısı yalnız demetler için ayrılır.
//
//  ÖLÇÜLEN (A/B: BATTLE_KAPMA_TEHLIKE kapalı vs açık, AYNI tohumlar):
//    · istihkâm ölümü            → düşmeli
//    · TEHLİKEDE ölen istihkâm   → asıl hedef (ölürken yakınında düşman vardı)
//    · tamamlanan ele geçirme    → ÇÖKMEMELİ (mekanik iptal edilmiyor, erteleniyor)
//
//    node tools/kapma-teshis.js --tohum 24
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 24)) || 24);
const TOHUM0 = Number(arg('--tohum0', 300000)) || 300000;
const MAX_TIK = Number(arg('--maxtik', 7200)) || 7200;

function kos(ctx, seed, kapi) {
    const kod = '(() => {' +
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
        'BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;' +
        'BATTLE_KAPMA_TEHLIKE = ' + (kapi ? 'true' : 'false') + ';' +
        'BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false;' +   // arama KAPALI: tek değişken kalsın
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
        'battleDeployManifest(mv, false, { source:"kapma", ally:true });' +
        'startBattle(); SIM.headless = true;' +
        // Takip: istihkâm ölümleri (ölüm anında yakında düşman var mıydı) + ele geçirmeler
        'const IST = T.ENGINEER;' +
        'let istOlum = 0, istTehlikedeOlum = 0, kapma = 0;' +
        'const oncekiOlu = new Set(); const oncekiTerk = new Set();' +
        'for (const u of SIM.units) if (u.abandoned) oncekiTerk.add(u.id);' +
        'let st = 0;' +
        'while (SIM.tick < ' + MAX_TIK + ' && phase === PHASE.BATTLE) {' +
        '  if (SIM.battle && SIM.battle.winnerSide !== null) break;' +
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
        '  if (SIM.tick % 4) continue;' +   // 5 tikte bir tarama yeter (ölüm kalıcı)
        '  for (const u of SIM.units) {' +
        '    if (u.type === IST && u.dead && !oncekiOlu.has(u.id)) {' +
        '      oncekiOlu.add(u.id); istOlum++;' +
        // ÖLÜM ANINDA yakında düşman var mıydı — "tehlikede öldü" ölçüsü
        '      let tehdit = false;' +
        '      for (const o of SIM.units) {' +
        '        if (o.dead || o.abandoned || o.loaded || o.isRed === u.isRed) continue;' +
        '        if (Math.hypot(o.x - u.x, o.y - u.y) < 500) { tehdit = true; break; }' +
        '      }' +
        '      if (tehdit) istTehlikedeOlum++;' +
        '    }' +
        // terk edilmişken artık terk-edilmemiş = ele geçirilmiş
        '    if (oncekiTerk.has(u.id) && !u.abandoned && !u.dead) { oncekiTerk.delete(u.id); kapma++; }' +
        '    if (u.abandoned && !oncekiTerk.has(u.id)) oncekiTerk.add(u.id);' +
        '  }' +
        '}' +
        'let istKalan = 0; for (const u of SIM.units) if (u.type === IST && !u.dead) istKalan++;' +
        'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);' +
        'return JSON.stringify({ seed:' + seed + ', istOlum, istTehlikedeOlum, kapma, istKalan,' +
        '  marj: Math.round(oS.effectiveValue - oD.effectiveValue), bitisTik: SIM.tick });' +
        '})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'kapma-' + seed + '.js' }));
}

function ozet(k) {
    const n = k.length, s = (f) => k.reduce((a, x) => a + f(x), 0);
    return { mac: n, istOlum: s(x => x.istOlum) / n, tehlikede: s(x => x.istTehlikedeOlum) / n,
        kapma: s(x => x.kapma) / n, kalan: s(x => x.istKalan) / n, marj: s(x => x.marj) / n };
}

function main() {
    const { ctx, hatalar } = tezgahKur();
    if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }
    console.log('KAPMA TESHISI — istihkam ele gecirme icin oluyor mu?');
    console.log('  ' + N + ' tohum, ESLESTIRILMIS (ayni tohum iki kolda), arama KAPALI');
    console.log('');
    const kollar = {};
    for (const kapi of [false, true]) {
        const kayit = [];
        for (let i = 0; i < N; i++) kayit.push(kos(ctx, TOHUM0 + i, kapi));
        kollar[kapi ? 'acik' : 'kapali'] = kayit;
        process.stdout.write('  ' + (kapi ? 'acik' : 'kapali') + ' bitti\r');
    }
    const bas = 'kol'.padEnd(9) + 'istOlum'.padStart(9) + 'TEHLIKEDE'.padStart(11) +
        'kapma'.padStart(8) + 'kalan'.padStart(8) + 'marj'.padStart(9);
    console.log(bas.padEnd(10)); console.log('-'.repeat(bas.length));
    for (const ad of ['kapali', 'acik']) {
        const o = ozet(kollar[ad]);
        console.log(ad.padEnd(9) + o.istOlum.toFixed(2).padStart(9) + o.tehlikede.toFixed(2).padStart(11) +
            o.kapma.toFixed(2).padStart(8) + o.kalan.toFixed(2).padStart(8) + Math.round(o.marj).toString().padStart(9));
    }
    // EŞLEŞTİRİLMİŞ FARK (mekanizma ölçüsü — gürültüsüz olması beklenir)
    const a = kollar['acik'], k = kollar['kapali'];
    const ciftT = a.map((x, i) => x.istTehlikedeOlum - k[i].istTehlikedeOlum);
    const ciftK = a.map((x, i) => x.kapma - k[i].kapma);
    const ist = (v) => {
        const n = v.length, m = v.reduce((s, x) => s + x, 0) / n;
        const sd = Math.sqrt(v.reduce((s, x) => s + (x - m) * (x - m), 0) / Math.max(1, n - 1));
        return { m, sd, t: sd > 0 ? m / (sd / Math.sqrt(n)) : (m === 0 ? 0 : Infinity) };
    };
    const tT = ist(ciftT), tK = ist(ciftK);
    console.log('');
    console.log('  TEHLIKEDE OLEN ISTIHKAM  fark ' + tT.m.toFixed(2) + '  t ' + tT.t.toFixed(2) +
        (tT.m < 0 && Math.abs(tT.t) >= 2 ? '  -> DUZELDI' : (Math.abs(tT.t) < 2 ? '  -> anlamli DEGIL' : '  -> KOTULESTI')));
    console.log('  ELE GECIRME              fark ' + tK.m.toFixed(2) + '  t ' + tK.t.toFixed(2) +
        (tK.m < -0.5 && Math.abs(tK.t) >= 2 ? '  -> MEKANIK COKTU (kabul edilemez)' : '  -> korundu'));
    console.log('');
    console.log('  KAPI: tehlikede olen istihkam DUSMELI, ele gecirme COKMEMELI.');
}

main();
