'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  SALDIRAN TEŞHİSİ — "saldıran %38 kazanıyor" bulgusunun MEKANİZMASI ne?
//
//  ÖLÇÜLDÜ (tools/rol-dengesi.js, 96 tohum, temiz alet): saldıran kazanma %38.5,
//  marj −833, t −3.02. Bu araç SEBEBİ arar; düzeltme önermez, veri üretir.
//
//  TAHMİN ETMEDEN ÖNCE SORULAN SORULAR (her biri ayrı bir kolon):
//    1. Saldıran İLERLİYOR mu?      → cephe-y'sinin zamana göre ilerlemesi
//    2. ATEŞ EDEBİLİYOR mu?         → ölürken mühimmatı dolu olan oranı
//    3. TAKAS nerede bozuluyor?     → 30sn'lik dilimlerde iki tarafın kaybı
//    4. Savunan SİPERDE mi öldürüyor?→ öldüren birimin entrench ortalaması
//    5. Kim öldürüyor?              → saldıranı en çok öldüren birim tipleri
//
//  KURGU rol-dengesi.js ile AYNI (aynı tuzaklar geçerli — bkz OLCUM-TUZAKLARI I1:
//  BATTLE_FORCE_VARIED oturumdan ÖNCE açılır, yoksa iki taraf farklı dağılımdan kurulur).
//
//    node tools/saldiran-teshis.js --tohum 24
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 24)) || 24);
const TOHUM0 = Number(arg('--tohum0', 100000)) || 100000;
const MAX_TIK = Number(arg('--maxtik', 7200)) || 7200;

function macKos(ctx, seed) {
    const kod = '(() => {' +
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
        'BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;' +
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;' +
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;' +
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;' +   // OTURUMDAN ÖNCE (tuzak I1)
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true,' +
        '  durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
        'BATTLE_REPLAY.telemetry = null;' +
        'if (typeof BATTLE_REPLAY_KAYITSIZ !== "undefined") BATTLE_REPLAY_KAYITSIZ = true;' +
        'const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,' +
        '  brainIntel4:true, isAttacker:false, pro:false });' +
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;' +
        'battleDeployManifest(mv, false, { source:"saldiran-teshis", ally:true });' +
        'startBattle();' +
        'const ph = SIM.headless; SIM.headless = true;' +
        // ÖLÜM DEFTERİ: her tik yeni ölenleri yakala (geçiş — bir kez).
        'const oldu = new Set(); const olum = [];' +
        'const dilim = [];' +   // 30sn = 600 tik dilimlerinde kayıp değeri
        'const ilerleme = [];' + // saldıranın cephe-y ortalaması
        'const deger = u => (STATS[u.type] && STATS[u.type].cost) || 0;' +
        'let st = 0;' +
        'try { while (SIM.tick < ' + MAX_TIK + ' && phase === PHASE.BATTLE) {' +
        '  if (SIM.battle && SIM.battle.winnerSide !== null) break;' +
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
        '  for (const u of SIM.units) {' +
        '    if (!u.dead || oldu.has(u.id)) continue;' +
        '    oldu.add(u.id);' +
        '    olum.push({ red: !!u.isRed, tip: u.type, tik: SIM.tick, y: Math.round(u.y),' +
        '      deger: deger(u), maxAmmo: u.maxAmmo || 0, ammo: u.ammo || 0,' +
        '      hicAtes: u._hicAtesEtmedi !== false });' +
        '  }' +
        '  if (SIM.tick % 200 === 0) {' +
        '    let sy = 0, sn2 = 0, dy = 0, dn = 0, ent = 0, entN = 0;' +
        '    const salYs = [], savYs = [];' +
        '    for (const u of SIM.units) { if (u.dead) continue;' +
        '      if (u.isRed) { sy += u.y; sn2++; salYs.push(u.y); } else { dy += u.y; dn++; savYs.push(u.y); if (u.entrench != null) { ent += u.entrench; entN++; } } }' +
        /* ON HAT: ortalama-y GERIDEKI topcuyu da sayar ve "hat kapanmiyor" izlenimi verir.
           Saldiran KIRMIZI, yukaridan asagi ilerler -> onculeri EN BUYUK y. Savunanin
           onculeri EN KUCUK y. 75./25. yuzdelik = gercek temas cizgisi. */
        '    salYs.sort((a,b)=>a-b); savYs.sort((a,b)=>a-b);' +
        '    const yuzde = (arr,p) => arr.length ? arr[Math.min(arr.length-1, Math.floor(arr.length*p))] : null;' +
        '    const salOn = yuzde(salYs, 0.75), savOn = yuzde(savYs, 0.25);' +
        // DURUŞ: taarruz kapısı hiç açılıyor mu? (SIM.ctrlPosture — canlı kontrolör nesnesi DEĞİL)
        // role: "attacker"/"defender" (isRed DEĞİL — kayıt taraf değil ROL tutuyor)
        '    let salDurus = null, savDurus = null, salKapi = null;' +
        '    if (SIM.ctrlPosture) { for (const k in SIM.ctrlPosture) { const p = SIM.ctrlPosture[k];' +
        '      if (!p) continue;' +
        '      if (p.role === "attacker") { salDurus = p.stance || null; salKapi = p.open; }' +
        '      else if (p.role != null) { savDurus = p.stance || null; } } }' +
        '    ilerleme.push({ tik: SIM.tick, salY: sn2 ? Math.round(sy / sn2) : null,' +
        '      savY: dn ? Math.round(dy / dn) : null, savSiper: entN ? +(ent / entN).toFixed(3) : null,' +
        '      salCanli: sn2, savCanli: dn, salDurus: salDurus, savDurus: savDurus, salKapi: salKapi,' +
        '      salOn: salOn!=null?Math.round(salOn):null, savOn: savOn!=null?Math.round(savOn):null });' +
        '  }' +
        '} } finally { SIM.headless = ph; }' +
        'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);' +
        'const b = SIM.battle || {};' +
        'return JSON.stringify({ seed: ' + seed + ',' +
        '  marj: Math.round(oS.effectiveValue - oD.effectiveValue),' +
        '  kazanan: (b.winnerSide === true ? "saldiran" : b.winnerSide === false ? "savunan" : null),' +
        '  bitisTik: SIM.tick, olum: olum, ilerleme: ilerleme,' +
        '  dunyaY: WORLD_H });' +
        '})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'st-' + seed + '.js' }));
}

function main() {
    const { ctx, hatalar } = tezgahKur();
    if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }

    const maclar = [];
    for (let i = 0; i < N; i++) {
        maclar.push(macKos(ctx, TOHUM0 + i));
        process.stdout.write('  ' + maclar.length + '/' + N + '\r');
    }
    const W = maclar[0].dunyaY;
    console.log(' '.repeat(24) + '\r');

    // ── 1. SONUÇ
    const sal = maclar.filter(m => m.kazanan === 'saldiran').length;
    console.log('SALDIRAN TESHISI — ' + N + ' tohum');
    console.log('  saldiran kazanma: ' + sal + '/' + N + ' = %' + (sal / N * 100).toFixed(1) +
        '   ort marj ' + Math.round(maclar.reduce((a, m) => a + m.marj, 0) / N) +
        '   ort sure ' + Math.round(maclar.reduce((a, m) => a + m.bitisTik, 0) / N * 0.05) + 'sn');
    console.log('');

    // ── 2. DİLİM DİLİM KAYIP (30sn = 600 tik)
    console.log('  ZAMANA GORE KAYIP DEGERI (30sn dilimleri, tohum basina ortalama)');
    console.log('    dilim   saldiran   savunan    takas');
    const DIL = 600;
    for (let d = 0; d < 8; d++) {
        let s = 0, v = 0;
        for (const m of maclar) for (const o of m.olum) {
            if (o.tik < d * DIL || o.tik >= (d + 1) * DIL) continue;
            if (o.red) s += o.deger; else v += o.deger;
        }
        s /= N; v /= N;
        if (s + v < 1) continue;
        console.log('    ' + String(d * 30 + '-' + (d + 1) * 30 + 'sn').padEnd(9) +
            String(Math.round(s)).padStart(8) + String(Math.round(v)).padStart(10) +
            ('  ' + (s > 0 ? (v / s).toFixed(2) : '-') + ':1').padStart(9));
    }
    console.log('    (takas = savunanin kaybi / saldiranin kaybi; 1.00 = esit)');
    console.log('');

    // ── 3. ÖLÜRKEN MÜHİMMAT DOLU MU / HİÇ ATEŞ ETMEDEN
    for (const [ad, red] of [['saldiran', true], ['savunan', false]]) {
        const l = maclar.flatMap(m => m.olum).filter(o => o.red === red);
        const cephaneli = l.filter(o => o.maxAmmo > 0);
        const dolu = cephaneli.filter(o => o.ammo / o.maxAmmo > 0.8).length;
        const hic = l.filter(o => o.hicAtes).length;
        console.log('  ' + ad.toUpperCase().padEnd(9) + ' olum ' + String(l.length).padStart(5) +
            '   hic ates etmeden %' + (hic / Math.max(1, l.length) * 100).toFixed(1) +
            '   olurken cephanesi >%80 dolu: %' + (dolu / Math.max(1, cephaneli.length) * 100).toFixed(1));
    }
    console.log('');

    // ── 4. İLERLEME + SİPER
    console.log('  CEPHE ILERLEMESI (saldiran KIRMIZI, dunya yuksekligi ' + W + ')');
    console.log('    sn    salOrtY  salON  savON  ON-ARA  savSiper salCanli savCanli');
    const noktalar = maclar[0].ilerleme.map((_, i) => i);
    for (const i of noktalar) {
        const ok = maclar.filter(m => m.ilerleme[i]);
        if (ok.length < N * 0.5) break;   // maçların yarısı bittiyse dur
        const g = k => Math.round(ok.reduce((a, m) => a + (m.ilerleme[i][k] || 0), 0) / ok.length);
        const gs = k => +(ok.reduce((a, m) => a + (m.ilerleme[i][k] || 0), 0) / ok.length).toFixed(3);
        console.log('    ' + String(Math.round(ok[0].ilerleme[i].tik * 0.05)).padStart(4) +
            String(g('salY')).padStart(9) + String(g('salOn')).padStart(7) + String(g('savOn')).padStart(7) +
            String(Math.abs(g('salOn') - g('savOn'))).padStart(8) +
            String(gs('savSiper')).padStart(10) +
            String(g('salCanli')).padStart(9) + String(g('savCanli')).padStart(9));
    }
    console.log('');

    // ── 4b. SALDIRANIN DURUS DAGILIMI + TAARRUZ KAPISI
    const durusSay = {}, kapiSay = { acik: 0, kapali: 0, yok: 0 };
    for (const m of maclar) for (const s2 of m.ilerleme) {
        const d = s2.salDurus || '(yok)';
        durusSay[d] = (durusSay[d] || 0) + 1;
        if (s2.salKapi === true) kapiSay.acik++; else if (s2.salKapi === false) kapiSay.kapali++; else kapiSay.yok++;
    }
    const topD = Object.values(durusSay).reduce((a, b) => a + b, 0) || 1;
    console.log('  SALDIRANIN DURUS DAGILIMI (ornek tik orani)');
    for (const [d, c] of Object.entries(durusSay).sort((a, b) => b[1] - a[1])) {
        console.log('    ' + d.padEnd(16) + ('%' + (c / topD * 100).toFixed(1)).padStart(8));
    }
    const topK = kapiSay.acik + kapiSay.kapali + kapiSay.yok || 1;
    console.log('  TAARRUZ KAPISI (strikeGateOpen): acik %' + (kapiSay.acik / topK * 100).toFixed(1) +
        '  kapali %' + (kapiSay.kapali / topK * 100).toFixed(1) + '  bilinmiyor %' + (kapiSay.yok / topK * 100).toFixed(1));
    console.log('');

    // ── 5. SALDIRANI EN COK KAYBETTIREN TIPLER
    const kayip = {};
    for (const m of maclar) for (const o of m.olum) if (o.red) kayip[o.tip] = (kayip[o.tip] || 0) + o.deger;
    const ad = t => {
        const s = vm.runInContext('(STATS[' + t + '] && STATS[' + t + '].id) || "?"', ctx);
        return s;
    };
    const sirali = Object.entries(kayip).sort((a, b) => b[1] - a[1]).slice(0, 8);
    console.log('  SALDIRANIN EN COK DEGER KAYBETTIGI TIPLER (toplam, ' + N + ' mac)');
    for (const [t, v] of sirali) console.log('    ' + ad(Number(t)).padEnd(24) + String(Math.round(v)).padStart(7));
}

main();
