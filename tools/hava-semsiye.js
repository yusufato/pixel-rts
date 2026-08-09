// HAVA SEMSIYESI A/B — 'adUmbrella' deltasi acilinca dusman havasi VURULABILIR hale geliyor mu?
//
// TABAN (kullanicinin 26 gercek maci, tools/helo-maruziyet.js):
//   attack_helo AI kayiplarinin %22'si · kurbanlarin %79'u AD menzilinde AMA
//   HELONUN KENDISI vurus aninda menzil∩gorusunde yalniz %21 · helo->AD medyan 1188px.
//
// MEKANIZMA METRIGI (mac sonucu DEGIL — beceri katmanlari dersi: mekanizma once, mac kapisi sonra):
//   V1 vurulabilirlik : dusman hava birimi bize ates ederken menzil∩gorusumuzde miydi?
//   V2 maruziyet      : dusman havasinin omrunun ne kadari AD menzilimizde?
//   V3 hava kaybi payi: kayiplarimizin yuzde kaci dusman HAVA birimlerinden?
//   V4 AD sagkalimi   : kendi AD birimlerimiz ne kadar yasiyor (ileri cikma bedeli)?
//   BAGLANMA          : BATTLE_BALANCE.adUmbrellaBind — 0 ise kural HIC calismadi, tablo anlamsiz.
//
// TARAF-BASI (tuzak B3): delta YALNIZ KIRMIZIDA acilir; mavi her iki kolda ayni kalir.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N_MAC = Math.max(1, Number(arg('--mac', 8)) || 8);
const ROL = arg('--rol', 'her');
const HAVUZ = []; for (let i = 0; i < 128; i++) HAVUZ.push(100000 + i * 163);
const TOHUMLAR = HAVUZ.slice(0, N_MAC);
const yaz = (s) => { try { fs.writeSync(1, s + '\n'); } catch (e) { console.log(s); } };
const ARA = path.join(__dirname, '..', 'qa-runtime', 'hava-semsiye-ARA.json');

const { ctx } = tezgahKur();

function kos(seed, kirmiziSaldiran, acik) {
    const kod = `(() => {
    BATTLE_RECIPE_RED = null;
    BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
    BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;
    BATTLE_INTEL4PRO_DELTAS_RED = ${acik ? "{ adUmbrella: true }" : "null"};
    BATTLE_INTEL4PRO_DELTAS_BLUE = null;
    if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
    if (typeof BATTLE_BALANCE !== 'undefined') { BATTLE_BALANCE.on = true; BATTLE_BALANCE.adUmbrellaBind = 0; }
    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${seed}, attackerSide:${kirmiziSaldiran},
        durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
    battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
        brainIntel4:true, isAttacker:${!kirmiziSaldiran}, pro:true }), false, { source:'hs', ally:true });
    startBattle();

    // KIRMIZININ hava savunmasi ve MAVININ hava birimleri (veriden turetilir, elle liste YOK)
    const havaMenzili = (t, hedefTuru) => {
        const st = STATS[t]; if (!st || !st.weapons) return 0;
        let r = 0; for (const w of st.weapons)
            if (Array.isArray(w.targets) && w.targets.includes(hedefTuru)) r = Math.max(r, w.range || 0);
        return r;
    };
    const ph = SIM.headless; SIM.headless = true; let st = 0;
    let vOrnek = 0, vMenzil = 0, vGorus = 0, vIkisi = 0;      // dusman havasinin maruziyeti (ORAN — yorunge-bagimli)
    let adOrnek = 0, adCanli = 0;
    // MUTLAK SAYIM (yorunge-bagimsiz): dusman HAVA birimlerinin bize verdigi hasar/olum.
    // Oran metrikleri yaniltti (kendi sagkalimim degisince payda kayiyor) → mutlak kalem esas.
    let havaHasar = 0, havaOlum = 0, havaOlumDeger = 0, toplamOlum = 0, toplamOlumDeger = 0;
    let dusHavaOlum = 0;                                       // BIZIM dusurdugumuz dusman hava birimi
    let mesafeTop = 0, mesafeN = 0;                            // M6: dusman havasi -> en yakin AD'miz
    let sonSeq = -1;
    const havaMi = (t) => { const s = STATS[t]; return !!(s && (s.category === 'air' || s.category === 'uav')); };
    const bosalt = () => {
        if (typeof BATTLE_FORENSIC === 'undefined') return;
        for (const ev of BATTLE_FORENSIC.buf) {
            if (ev.seq <= sonSeq) continue;
            sonSeq = ev.seq;
            const dg = (STATS[ev.targetType] && STATS[ev.targetType].cost) || 0;
            if (ev.targetSide === 'red') {
                if (havaMi(ev.attackerType)) { havaHasar += ev.damage || 0; if (ev.lethal) { havaOlum++; havaOlumDeger += dg; } }
                if (ev.lethal) { toplamOlum++; toplamOlumDeger += dg; }
            } else if (ev.targetSide === 'blue' && ev.lethal && havaMi(ev.targetType) && ev.attackerSide === 'red') {
                dusHavaOlum++;
            }
        }
    };
    const adBaslangic = SIM.units.filter(u => u.isRed && !u.dead && STATS[u.type] && STATS[u.type].category === 'air_defense').length;
    const kirmiziBaslangic = SIM.units.filter(u => u.isRed && !u.dead).length;
    try {
        while (SIM.tick < 7300 && phase === PHASE.BATTLE) {
            st += BATTLE_TICK_MS;
            stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
            if (typeof updateSupport === 'function') updateSupport(BATTLE_TICK_SEC, st);
            if (SIM.tick % 10 !== 0) continue;
            bosalt();
            const canli = SIM.units.filter(u => !u.dead && !u.loaded && !u.abandoned);
            const bizimAD = canli.filter(u => u.isRed && STATS[u.type] && STATS[u.type].category === 'air_defense');
            const radarlar = canli.filter(u => u.isRed && STATS[u.type] && STATS[u.type].airRadar);
            adOrnek++; adCanli += bizimAD.length;
            for (const h of canli) {
                if (h.isRed || !h.isAir) continue;                 // MAVININ hava birimleri
                vOrnek++;
                // M6 — KURALIN DOGRUDAN HEDEFI: dusman havasi ile en yakin AD'miz arasindaki mesafe.
                // TABAN (26 gercek mac): vurus aninda medyan 1188px, en yakin AD cogunlukla manpads(825) → MENZIL DISI.
                { let en = Infinity;
                  for (const a of bizimAD) { const d = Math.hypot(a.x - h.x, a.y - h.y); if (d < en) en = d; }
                  if (en < Infinity) { mesafeTop += en; mesafeN++; } }
                let mIn = false, gIn = false;
                for (const a of bizimAD) {
                    const d = Math.hypot(a.x - h.x, a.y - h.y);
                    if (d <= havaMenzili(a.type, 'air')) mIn = true;
                    if (d <= (STATS[a.type].vision || 0)) gIn = true;
                }
                if (!gIn) for (const r of radarlar) {
                    if (Math.hypot(r.x - h.x, r.y - h.y) <= (STATS[r.type].vision || 0)) { gIn = true; break; }
                }
                if (mIn) vMenzil++;
                if (gIn) vGorus++;
                if (mIn && gIn) vIkisi++;
            }
        }
    } finally { SIM.headless = ph; }
    bosalt();
    const oK = battleArmyObservation(true), oM = battleArmyObservation(false);
    const adSon = SIM.units.filter(u => u.isRed && !u.dead && STATS[u.type] && STATS[u.type].category === 'air_defense').length;
    return JSON.stringify({
        marj: Math.round(oK.effectiveValue - oM.effectiveValue),
        vOrnek, vMenzil, vGorus, vIkisi,
        havaHasar: Math.round(havaHasar), havaOlum, havaOlumDeger, toplamOlum, toplamOlumDeger, dusHavaOlum,
        mesafeTop: Math.round(mesafeTop), mesafeN,
        adBaslangic, adSon, adOrt: adOrnek ? (adCanli / adOrnek) : 0,
        kirmiziBaslangic, kirmiziSon: SIM.units.filter(u => u.isRed && !u.dead).length,
        bind: (typeof BATTLE_BALANCE !== 'undefined' ? (BATTLE_BALANCE.adUmbrellaBind || 0) : 0)
    });
})()`;
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'hs.js' }));
}

const roller = ROL === 'her' ? [true, false] : [ROL === 'saldiran'];
yaz('HAVA SEMSIYESI A/B — delta adUmbrella (yalniz KIRMIZIDA)');
yaz('  ' + TOHUMLAR.length + ' tohum x ' + roller.length + ' rol x 2 kol = ' + (TOHUMLAR.length * roller.length * 2) + ' mac');
yaz('  TABAN (26 gercek oyuncu maci): helo vurus aninda menzil∩gorus %21');
yaz('');

const K = { kapali: [], acik: [] };
for (let i = 0; i < TOHUMLAR.length; i++) {
    for (const kS of roller) {
        const a = kos(TOHUMLAR[i], kS, false);
        const b = kos(TOHUMLAR[i], kS, true);
        K.kapali.push(a); K.acik.push(b);
        yaz('  [' + (i + 1) + '/' + TOHUMLAR.length + '] tohum ' + TOHUMLAR[i] + ' ' + (kS ? 'SALD' : 'SAVU') +
            '  vurulabilirlik ' + (a.vOrnek ? Math.round(a.vIkisi / a.vOrnek * 100) : 0) + '% -> ' +
            (b.vOrnek ? Math.round(b.vIkisi / b.vOrnek * 100) : 0) + '%' +
            '   marj ' + a.marj + ' -> ' + b.marj + '   bind ' + b.bind);
        fs.writeFileSync(ARA, JSON.stringify(K, null, 1));
    }
}
const ort = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const oranTop = (arr, p, q) => { const P = arr.reduce((s, r) => s + r[p], 0), Q = arr.reduce((s, r) => s + r[q], 0); return Q ? P / Q : 0; };

yaz('');
yaz('  ══ BAGLANMA (0 ise tablo ANLAMSIZ) ══');
yaz('    acik kolda toplam bind : ' + K.acik.reduce((s, r) => s + r.bind, 0) +
    '   bind>0 olan mac: ' + K.acik.filter(r => r.bind > 0).length + '/' + K.acik.length);
yaz('    kapali kolda bind      : ' + K.kapali.reduce((s, r) => s + r.bind, 0) + '  (0 olmali)');
yaz('');
yaz('  ══ MEKANIZMA METRIKLERI ══');
yaz('  ' + 'metrik'.padEnd(34) + 'KAPALI'.padStart(10) + 'ACIK'.padStart(10) + 'fark'.padStart(10));
const satir = (ad, f) => {
    const a = f(K.kapali), b = f(K.acik);
    yaz('  ' + ad.padEnd(34) + a.toFixed(1).padStart(10) + b.toFixed(1).padStart(10) + (b - a).toFixed(1).padStart(10));
};
yaz('  -- MUTLAK (esas kalem; oran metrikleri yorunge-bagimli) --');
satir('M1 dusman havasindan ALINAN HASAR', arr => ort(arr.map(r => r.havaHasar)));
satir('M2 dusman havasinin OLDURDUGU birim', arr => ort(arr.map(r => r.havaOlum)));
satir('M3 hava kaynakli kayip DEGERI (TL)', arr => ort(arr.map(r => r.havaOlumDeger)));
satir('M4 hava kayip PAYI % (deger)', arr => oranTop(arr, 'havaOlumDeger', 'toplamOlumDeger') * 100);
satir('M5 DUSURDUGUMUZ dusman hava birimi', arr => ort(arr.map(r => r.dusHavaOlum)));
satir('M6 dusman havasi -> AD mesafesi (px)', arr => oranTop(arr, 'mesafeTop', 'mesafeN'));
yaz('  -- ORAN (yorunge-bagimli, YALNIZ baglam icin) --');
satir('V1 vurulabilirlik %(menzil∩gorus)', arr => oranTop(arr, 'vIkisi', 'vOrnek') * 100);
satir('V2 maruziyet %(menzilde)', arr => oranTop(arr, 'vMenzil', 'vOrnek') * 100);
satir('V4 AD sagkalimi %(son/baslangic)', arr => oranTop(arr, 'adSon', 'adBaslangic') * 100);
satir('   kendi sagkalim %(kirmizi)', arr => oranTop(arr, 'kirmiziSon', 'kirmiziBaslangic') * 100);
satir('   toplam kaybimiz (adet)', arr => ort(arr.map(r => r.toplamOlum)));

// MAC KAPISI — eslestirilmis fark (mekanizma gecerse anlamli, gecmezse yalniz kayit icin)
const fark = K.acik.map((b, i) => b.marj - K.kapali[i].marj);
const o = ort(fark);
const sd = Math.sqrt(fark.reduce((a, b) => a + (b - o) ** 2, 0) / Math.max(1, fark.length - 1));
const se = sd / Math.sqrt(fark.length);
yaz('');
yaz('  ══ MAC KAPISI (eslestirilmis fark, ' + fark.length + ' mac) ══');
yaz('    marj farki ort ' + Math.round(o) + '   std.hata ' + Math.round(se) + '   t ' + (se ? (o / se).toFixed(2) : '-'));
yaz('    UYARI: marj std ~3100; ' + fark.length + ' mac KARAR icin yetmez (37+ gerekir). Mekanizma metrigi baglayicidir.');
fs.writeFileSync(path.join(__dirname, '..', 'qa-runtime', 'hava-semsiye.json'), JSON.stringify(K, null, 1));
