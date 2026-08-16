'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  ROL DENGESİ — saldıran mı savunan mı kazanıyor, ve bir DEĞİŞİKLİK bunu kaydırdı mı?
//
//  NEDEN AYRI BİR KAPI: tools/kapi-paralel.js (pro vs intel4) BEYİN karşılaştırır ve
//  tasarımı gereği rolü/tarafı AYNALAR — yani yapısal saldıran↔savunan kaymasını
//  görmez, sıfırlar. Kalıcı ileri üs, mayın alanı, hold_fire gibi değişiklikler ise
//  tam olarak o eksende etki eder (üs savunanın işine yarar). Bu araç o boşluğu kapatır.
//
//  KURGU: iki tarafta da AYNI beyin (intel4). Tek asimetri ROL. Böylece kazanma oranı
//  %50'den sapıyorsa sebep beyin değil, KURALLAR/YAPI'dır.
//
//  A/B: --kol <isim>=<deger>,... verilirse o global iki kolda da açılıp kapatılır ve
//  EŞLEŞTİRİLMİŞ fark ölçülür (aynı tohum iki kolda da koşar → tohum gürültüsü düşer).
//    node tools/rol-dengesi.js --tohum 96
//    node tools/rol-dengesi.js --tohum 96 --kol BATTLE_ISTIHKAM_US
//
//  ÖLÇÜM TUZAKLARI (docs/OLCUM-TUZAKLARI.md):
//    · Marj std ≈ 2770 → 3-6 tohumluk koşu KARAR VERMEZ. Varsayılan 96 tohum.
//    · Eşleştirilmiş fark kullanılır; kollar AYRI tohum kümesi görürse sonuç çöp olur.
//    · Her maç kendi tohumuyla bağımsız; işçilere bölmek sonucu DEĞİŞTİRMEZ.
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 96)) || 96);
const TOHUM0 = Number(arg('--tohum0', 100000)) || 100000;   // CYBORG havuzu (docs/IKI-MAKINE.md)
const KOL = arg('--kol', null);                              // A/B'lenecek global adı
/* --esitkomp: SALDIRAN ordusunu da savunanin kompozisyon kurallariyla kur.
   NEDEN: BattleDeployment savunana IKI taban veriyor (AT >= %15 butce; dolayli+AA
   alt-tur garantisi) ve ikisi de `config.isAttacker === false` sartli. Saldiranin
   AT tabani ise `config.pro === true` istiyor -> pro:false kosuda saldiranin HIC
   tabani yok. Bu bayrak, rol farkinin KOMPOZISYONDAN mi TAKTIKTEN mi geldigini ayirir. */
const ESIT_KOMP = process.argv.includes('--esitkomp');
const MAX_TIK = Number(arg('--maxtik', 7200)) || 7200;
const CIKTI = arg('--json', null);

const TOHUMLAR = Array.from({ length: N }, (_, i) => TOHUM0 + i);

function macKos(ctx, seed, kolDeger) {
    const kod = '(() => {' +
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
        'BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;' +
        (KOL ? (KOL + ' = ' + JSON.stringify(kolDeger) + ';') : '') +
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;' +
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;' +
        /* VARIED, OTURUMDAN ÖNCE AÇILMALI. Kırmızı (saldıran) ordu openBattlefieldSession
           İÇİNDE kurulur; bayrak sonradan açılırsa saldıran varied-OLMAYAN, savunan
           varied-OLAN dağılımdan kurulur ve iki taraf FARKLI kurala tabi olur.
           İlk sürümde bu hata vardı → "saldıran %30 kazanıyor" ölçümü şüpheliydi. */
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;' +
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true,' +
        '  durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
        'BATTLE_REPLAY.telemetry = null;' +
        'if (typeof BATTLE_REPLAY_KAYITSIZ !== "undefined") BATTLE_REPLAY_KAYITSIZ = true;' +
        // İKİ TARAF DA AYNI BEYİN + AYNI BÜTÇE + AYNI DAĞILIM. Tek fark rol (kırmızı = saldıran).
        'const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,' +
        '  brainIntel4:true, isAttacker:false, pro:false });' +
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;' +
        'battleDeployManifest(mv, false, { source:"rol-dengesi", ally:true });' +
        // SALDIRANI YENIDEN KUR (ayni kompozisyon kurallariyla). Rol DEGISMEZ - yalnizca ordu.
        (ESIT_KOMP ? (
            'for (let i = SIM.units.length - 1; i >= 0; i--) if (SIM.units[i].isRed) SIM.units.splice(i, 1);' +
            'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;' +
            'const mvR = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,' +
            '  brainIntel4:true, isAttacker:false, pro:false, isRed:true });' +
            'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;' +
            'battleDeployManifest(mvR, true, { source:"rol-dengesi-esitkomp" });'
        ) : '') +
        'startBattle();' +
        'const ph = SIM.headless; SIM.headless = true;' +
        'let st = 0;' +
        'try { while (SIM.tick < ' + MAX_TIK + ' && phase === PHASE.BATTLE) {' +
        '  if (SIM.battle && SIM.battle.winnerSide !== null) break;' +
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
        '} } finally { SIM.headless = ph; }' +
        'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);' +
        'const b = SIM.battle || {};' +
        'const marj = Math.round(oS.effectiveValue - oD.effectiveValue);' +
        'return JSON.stringify({ seed:' + seed + ', marj: marj,' +
        '  kazanan: (b.winnerSide === true ? "saldiran" : b.winnerSide === false ? "savunan" : (marj > 0 ? "saldiran" : marj < 0 ? "savunan" : "berabere")),' +
        '  karara_baglandi: b.winnerSide !== null,' +
        '  bitisSn: Math.round(SIM.tick * BATTLE_TICK_SEC),' +
        '  us: (SIM.trenches || []).filter(t => !t.isHospital).length,' +
        '  mayin: (SIM.mines || []).length });' +
        '})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'rol-' + seed + '.js' }));
}

function ozet(kayit) {
    const n = kayit.length;
    const sal = kayit.filter(k => k.kazanan === 'saldiran').length;
    const marj = kayit.map(k => k.marj);
    const ort = marj.reduce((a, b) => a + b, 0) / Math.max(1, n);
    const varyans = marj.reduce((a, b) => a + (b - ort) * (b - ort), 0) / Math.max(1, n - 1);
    const std = Math.sqrt(varyans);
    return {
        mac: n, saldiranGalibiyet: sal, saldiranOran: +(sal / Math.max(1, n)).toFixed(4),
        marjOrt: Math.round(ort), marjStd: Math.round(std),
        // t = ortalama / standart hata → |t| >= 2 kabaca anlamlı
        t: +(ort / (std / Math.sqrt(Math.max(1, n)))).toFixed(2),
        ortSn: Math.round(kayit.reduce((a, k) => a + k.bitisSn, 0) / Math.max(1, n)),
        ortUs: +(kayit.reduce((a, k) => a + k.us, 0) / Math.max(1, n)).toFixed(2),
        ortMayin: +(kayit.reduce((a, k) => a + k.mayin, 0) / Math.max(1, n)).toFixed(2)
    };
}

function main() {
    const { ctx, hatalar } = tezgahKur();
    if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }

    console.log('ROL DENGESI — ' + N + ' tohum, iki tarafta da intel4 (tek asimetri: ROL)');
    if (KOL) console.log('  A/B kolu: ' + KOL + '  (kapali vs acik, ESLESTIRILMIS ayni tohumlar)');
    if (ESIT_KOMP) console.log('  ESIT KOMPOZISYON: saldiran ordusu da savunan kurallariyla kuruldu');
    console.log('');

    const t0 = Date.now();
    const kollar = KOL ? [false, true] : [null];
    const sonuc = {};
    for (const kd of kollar) {
        const kayit = [];
        for (const s of TOHUMLAR) {
            kayit.push(macKos(ctx, s, kd));
            if (kayit.length % 16 === 0) process.stdout.write('  ' + (KOL ? (kd ? 'acik ' : 'kapali ') : '') + kayit.length + '/' + N + '\r');
        }
        sonuc[String(kd)] = { kayit: kayit, ozet: ozet(kayit) };
    }
    const sn = Math.round((Date.now() - t0) / 1000);

    console.log('  ── sure ' + sn + ' sn' + ' '.repeat(20));
    console.log('');
    const bas = 'kol'.padEnd(8) + 'mac'.padStart(5) + 'saldiran%'.padStart(11) + 'marjOrt'.padStart(9) +
        'marjStd'.padStart(9) + 't'.padStart(8) + 'sure(sn)'.padStart(10) + 'us'.padStart(7) + 'mayin'.padStart(8);
    console.log(bas); console.log('-'.repeat(bas.length));
    for (const kd of kollar) {
        const o = sonuc[String(kd)].ozet;
        console.log((KOL ? (kd ? 'acik' : 'kapali') : 'taban').padEnd(8) +
            String(o.mac).padStart(5) + (('%' + (o.saldiranOran * 100).toFixed(1))).padStart(11) +
            String(o.marjOrt).padStart(9) + String(o.marjStd).padStart(9) + String(o.t).padStart(8) +
            String(o.ortSn).padStart(10) + String(o.ortUs).padStart(7) + String(o.ortMayin).padStart(8));
    }
    console.log('');
    console.log('  marj > 0 = SALDIRAN onde.  |t| >= 2 kabaca anlamli sapma (%50 dengeden).');

    if (KOL) {
        // ESLESTIRILMIS FARK: ayni tohumda acik-kapali. Tohum gurultusu dusar.
        const a = sonuc['true'].kayit, k = sonuc['false'].kayit;
        const fark = a.map((x, i) => x.marj - k[i].marj);
        const n = fark.length;
        const ort = fark.reduce((s, v) => s + v, 0) / n;
        const varyans = fark.reduce((s, v) => s + (v - ort) * (v - ort), 0) / Math.max(1, n - 1);
        const std = Math.sqrt(varyans);
        const t = ort / (std / Math.sqrt(n));
        console.log('');
        console.log('  ESLESTIRILMIS FARK (acik - kapali): ort ' + Math.round(ort) +
            '  std ' + Math.round(std) + '  t ' + t.toFixed(2) +
            (Math.abs(t) >= 2 ? '  -> ANLAMLI' : '  -> anlamli DEGIL'));
        console.log('  (pozitif = kol SALDIRANIN isine yariyor, negatif = SAVUNANIN)');
    }

    if (CIKTI) {
        fs.writeFileSync(path.resolve(CIKTI), JSON.stringify(sonuc, null, 1));
        console.log('\nyazildi: ' + CIKTI);
    }
}

main();
