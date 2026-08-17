'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  KARAR DEĞİŞTİ Mİ? — maç kapısından ÖNCE koşulan UCUZ eleme
//
//  KULLANICI: "bu testler 1 saat sürüyor, ucuzlatamıyoruz da."
//  Haklı, ve sebebi ölçüldü: maç marjı std ≈ 2611; aynı tohumu iki kolda koşmak
//  varyansın yalnız %17'sini alıyor (3693 → 3050), çünkü simülasyon KAOTİK —
//  AI'daki küçük fark erken dallanıp maçı başkalaştırıyor. +400'lük etki için
//  n≈485 gerekiyor. Bu oyunun özelliği; maç kapısı ucuzlatılamaz.
//
//  UCUZLATILABİLECEK ŞEY: maç kapısına GİREN aday sayısı.
//
//  MANTIK: bir değişiklik aramanın SEÇTİĞİ ADAYI hiç değiştirmiyorsa, maç sonucunu
//  değiştirmesi de İMKÂNSIZ (arama motora yalnız o emirle dokunuyor). O hâlde önce
//  "karar değişiyor mu" diye sorulur — dakikalar sürer. Değişmiyorsa saatlik kapı
//  HİÇ koşulmaz.
//
//  ⚠ TEK YÖNLÜ KAPI: "karar değişiyor" maçın da değişeceğini KANITLAMAZ, yalnız
//  mümkün kılar. "Karar değişmiyor" ise maçın değişmeyeceğini KANITLAR. Bu yüzden
//  yalnız ELEME için kullanılır, onay için asla.
//
//    node tools/karar-degisti-mi.js --ayar "BATTLE_LA_KANAL=true" --tohum 3
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const AYAR = arg('--ayar', '');
const N = Math.max(1, Number(arg('--tohum', 3)) || 3);
const TOHUM0 = Number(arg('--tohum0', 640000)) || 640000;
const MAX_TIK = Number(arg('--maxtik', 2400)) || 2400;
if (!AYAR) { console.log('kullanim: --ayar "GLOBAL=deger; ..."'); process.exit(1); }

/* Kararları topla: her arama turunda her birim için SEÇİLEN adayın sınıfı.
   Aynı tohum + aynı tik + aynı birim = aynı karar noktası. İki kol bu noktalarda
   karşılaştırılır. */
function kos(ctx, seed, ayar) {
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
        'battleDeployManifest(mv, false, { source:"kdm", ally:true });' +
        'startBattle(); SIM.headless = true;' +
        'BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false;' +
        ayar + ';' +
        /* KARARLARI DEFTERDEN OKU: BATTLE_LA_KAYIT zaten her karar icin secilen
           adayin kafes sinifini (y) ve birim ozniteligini (b) tutuyor. Ayri bir
           toplama yolu yazmak, olculen seyin arama olmadigini riske atardi. */
        'BATTLE_LA_KAYIT.on = true; BATTLE_LA_KAYIT.buf.length = 0;' +
        'let st = 0;' +
        'try { while (SIM.tick < ' + MAX_TIK + ' && phase === PHASE.BATTLE) {' +
        '  if (SIM.battle && SIM.battle.winnerSide !== null) break;' +
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
        '  battleLookaheadTick(st);' +
        '} } finally { BATTLE_LA_KAYIT.on = false; BATTLE_LOOKAHEAD_RED = false; }' +
        // anahtar: tik + birimin konumu/tipi (kayitta id yok, b[0..2] konum+tip)
        'const kar = BATTLE_LA_KAYIT.buf.map(k => ({' +
        '  a: k.tik + "|" + (k.b ? k.b.slice(0,3).map(v => Math.round(v*1e4)).join(",") : "?"),' +
        '  y: k.y, e: k.e }));' +
        'BATTLE_LA_KAYIT.buf.length = 0;' +
        'return JSON.stringify({ kar, bitis: SIM.tick });' +
        '})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'kdm-' + seed + '.js' }));
}

function main() {
    const { ctx, hatalar } = tezgahKur();
    if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }
    console.log('KARAR DEGISTI MI? — mac kapisindan ONCE ucuz eleme');
    console.log('  ayar: ' + AYAR);
    console.log('  ' + N + ' tohum, ' + MAX_TIK + ' tik');
    console.log('');

    let ortak = 0, farkli = 0, ilkFarkTik = null;
    const t0 = Date.now();
    for (let i = 0; i < N; i++) {
        const seed = TOHUM0 + i;
        const A = kos(ctx, seed, '');           // taban
        const B = kos(ctx, seed, AYAR);         // degisiklik
        const mA = new Map(A.kar.map(k => [k.a, k.y]));
        let o = 0, f = 0;
        for (const k of B.kar) {
            if (!mA.has(k.a)) continue;
            if (mA.get(k.a) === k.y) o++;
            else { f++; if (ilkFarkTik === null) ilkFarkTik = Number(k.a.split('|')[0]); }
        }
        ortak += o; farkli += f;
        process.stdout.write('  tohum ' + seed + ': ' + (o + f) + ' ortak karar noktasi, ' + f + ' farkli\r');
    }
    const n = ortak + farkli;
    const oran = n ? farkli / n : 0;
    console.log(' '.repeat(70));
    console.log('  eslesen karar noktasi : ' + n);
    console.log('  KARAR DEGISTI         : ' + farkli + '  (%' + (oran * 100).toFixed(1) + ')');
    if (ilkFarkTik !== null) console.log('  ilk farkin tiki       : ' + ilkFarkTik);
    console.log('  sure: ' + ((Date.now() - t0) / 60000).toFixed(1) + 'dk');
    console.log('');
    if (oran < 0.02) {
        console.log('  ELENDI: kararlarin %' + (oran * 100).toFixed(1) + "'i degisiyor. Arama motora YALNIZ");
        console.log('  bu emirlerle dokunuyor -> mac sonucunu degistirmesi IMKANSIZ.');
        console.log('  SAATLIK MAC KAPISINI KOSMA.');
    } else {
        console.log('  GECTI: kararlarin %' + (oran * 100).toFixed(1) + "'i degisiyor -> mac sonucu DEGISEBILIR.");
        console.log('  Ama bu IYI oldugunu KANITLAMAZ. Simdi mac kapisi gerekli:');
        console.log('    node tools/rol-dengesi-paralel.js --tohum 128 --kol <GLOBAL> ...');
    }
}

main();
