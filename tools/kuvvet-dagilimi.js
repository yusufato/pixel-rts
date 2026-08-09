// KUVVET DAGILIMI TESHISI — savunan kutlesini NEREYE koyuyor ve orada YEREL USTUNLUGU var mi?
//
// NEDEN BU OLCUM: intel4-pro'nun KAPALI deltalarindan DORDU, birbirinden bagimsiz olculup
// ayni sonuca vardi (js/globals.js yorumlari):
//   localRatio     -> "dogru mudahale katmani ... KONTROLOR seviyesinde KUVVET DAGILIMI"
//   indirectCreep  -> "savunan kuvvetin TAMAMININ geride ve yayilmis durmasi ... katman KUVVET DAGILIMI"
//   holdZone       -> "acilmadan once gereken: savunan-rolune ozgu SAVUNMA KOMPOZISYONU"
//   supplyEscort   -> "hedef sorunu cozulurse (savunan durusu/kompozisyonu) ..."
// Dordu de BIRIM katmaninda cozulmedi. Bu arac iddiayi KONTROLOR katmaninda dogrudan olcer.
//
// OLCULEN (hepsi ham konumdan, tureti yok):
//   1. OLUM ANINDA yerel oran: olen birimin 600px cevresindeki dost/dusman sayisi (localRatio
//      teshisi 4 dost / 12.3 dusman demisti; o rakam ZIRHLI icindi, burada TUM roller).
//   2. OLUM DERINLIGI: kendi taban hattina gore normalize y (0=kendi tabani, 1=dusman tabani).
//      localRatio 0.44-0.47 (orta hat) bulmustu.
//   3. KUTLENIN kendi konumu: her 5sn'de kuvvetin derinlik ortalamasi ve yayilimi.
//   4. AYRISMA: kutle NEREDE vs olumler NEREDE — ikisi ayrisiyorsa "ince yayilmis" iddiasi dogrudur.
//
// TUZAK NOTU: taraf-basi bayrak (B3). Kirmizi = sinanan AI. attackerSide=false -> KIRMIZI SAVUNUR.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N_MAC = Math.max(1, Number(arg('--mac', 8)) || 8);
const ROL = arg('--rol', 'savunan');   // savunan | saldiran | her
const R_YEREL = Number(arg('--yaricap', 600)) || 600;
const HAVUZ = []; for (let i = 0; i < 128; i++) HAVUZ.push(100000 + i * 149);
const TOHUMLAR = HAVUZ.slice(0, N_MAC);
const yaz = (s) => { try { fs.writeSync(1, s + '\n'); } catch (e) { console.log(s); } };

const { ctx } = tezgahKur();

function kos(seed, kirmiziSaldiran) {
    const kod = `(() => {
    BATTLE_RECIPE_RED = null;
    BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
    BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;
    BATTLE_INTEL4PRO_DELTAS_RED = null; BATTLE_INTEL4PRO_DELTAS_BLUE = null;
    if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${seed}, attackerSide:${kirmiziSaldiran},
        durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
    battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
        brainIntel4:true, isAttacker:${!kirmiziSaldiran}, pro:true }), false, { source:'kd', ally:true });
    startBattle();

    // KENDI TABAN HATTI: kirmizi ustte (y kucuk) baslar, mavi altta. Derinlik = kendi tabanindan uzaklik.
    const yHepsi = SIM.units.filter(u => !u.dead).map(u => u.y);
    const yMin = Math.min.apply(null, yHepsi), yMax = Math.max.apply(null, yHepsi);
    const span = Math.max(1, yMax - yMin);
    const derinlik = (u) => u.isRed ? ((u.y - yMin) / span) : ((yMax - u.y) / span);

    const ph = SIM.headless; SIM.headless = true; let st = 0;
    const olumler = [], kutle = [];
    let onceki = new Map();
    for (const u of SIM.units) if (!u.dead) onceki.set(u.id, { x: u.x, y: u.y, isRed: u.isRed, tip: u.type });
    try {
        while (SIM.tick < 7300 && phase === PHASE.BATTLE) {
            st += BATTLE_TICK_MS;
            stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
            if (typeof updateSupport === 'function') updateSupport(BATTLE_TICK_SEC, st);
            if (SIM.tick % 10 !== 0) continue;   // 0.5sn ornekleme

            const canli = SIM.units.filter(u => !u.dead);
            // 1+2 — YENI OLENLER: yerel orani OLUMDEN ONCEKI ornekten hesapla (olen henuz oradaydi)
            const canliId = new Set(canli.map(u => u.id));
            for (const [id, p] of onceki) {
                if (canliId.has(id)) continue;
                let dost = 0, dus = 0;
                for (const [id2, q] of onceki) {
                    if (id2 === id) continue;
                    const d = Math.hypot(q.x - p.x, q.y - p.y);
                    if (d > ${R_YEREL}) continue;
                    if (q.isRed === p.isRed) dost++; else dus++;
                }
                const dpt = p.isRed ? ((p.y - yMin) / span) : ((yMax - p.y) / span);
                olumler.push({ kirmizi: p.isRed, tip: p.tip, dost, dus, derinlik: Math.round(dpt * 100) / 100,
                    sn: Math.round(SIM.tick * BATTLE_TICK_SEC) });
            }
            // 3 — KUTLENIN konumu (her 5sn)
            if (SIM.tick % 100 === 0) {
                for (const kirmiziMi of [true, false]) {
                    const g = canli.filter(u => u.isRed === kirmiziMi);
                    if (!g.length) continue;
                    const ds = g.map(derinlik);
                    const ort = ds.reduce((a, b) => a + b, 0) / ds.length;
                    const sd = Math.sqrt(ds.reduce((a, b) => a + (b - ort) ** 2, 0) / ds.length);
                    // YAYILIM: birimler arasi ortalama mesafe (blob olcusu)
                    let top = 0, n = 0;
                    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
                        top += Math.hypot(g[i].x - g[j].x, g[i].y - g[j].y); n++;
                    }
                    kutle.push({ kirmizi: kirmiziMi, sn: Math.round(SIM.tick * BATTLE_TICK_SEC),
                        derinlik: Math.round(ort * 100) / 100, derinlikSd: Math.round(sd * 100) / 100,
                        yayilim: n ? Math.round(top / n) : 0, adet: g.length });
                }
            }
            onceki = new Map();
            for (const u of canli) onceki.set(u.id, { x: u.x, y: u.y, isRed: u.isRed, tip: u.type });
        }
    } finally { SIM.headless = ph; }
    const oK = battleArmyObservation(true), oM = battleArmyObservation(false);
    return JSON.stringify({ olumler, kutle, marj: Math.round(oK.effectiveValue - oM.effectiveValue) });
})()`;
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'kd.js' }));
}

const roller = ROL === 'her' ? [true, false] : [ROL === 'saldiran'];
yaz('KUVVET DAGILIMI TESHISI — kutle NEREDE, olum NEREDE, yerel oran NE?');
yaz('  ' + TOHUMLAR.length + ' tohum x ' + roller.length + ' rol   yerel yaricap ' + R_YEREL + 'px');
yaz('  KIRMIZI = sinanan intel4-pro.  derinlik 0 = kendi tabani, 1 = dusman tabani');
yaz('');

const O = { kirmizi: [], mavi: [] }, K = { kirmizi: [], mavi: [] };
for (let i = 0; i < TOHUMLAR.length; i++) {
    for (const kSaldiran of roller) {
        const r = kos(TOHUMLAR[i], kSaldiran);
        for (const o of r.olumler) (o.kirmizi ? O.kirmizi : O.mavi).push(o);
        for (const k of r.kutle) (k.kirmizi ? K.kirmizi : K.mavi).push(k);
        yaz('  [' + (i + 1) + '/' + TOHUMLAR.length + '] tohum ' + TOHUMLAR[i] +
            '  kirmizi=' + (kSaldiran ? 'SALDIRAN' : 'SAVUNAN') +
            '  olum ' + r.olumler.length + '  marj ' + r.marj);
    }
}
const ort = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const med = (a) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

yaz('');
yaz('  ══ OLUM ANINDA YEREL DURUM (' + R_YEREL + 'px cember) ══');
yaz('  ' + 'taraf'.padEnd(10) + 'olum'.padStart(6) + 'dost'.padStart(8) + 'dusman'.padStart(8) +
    'oran'.padStart(8) + 'derinlik'.padStart(10) + '  ustun-olarak-olen');
for (const [ad, arr] of [['KIRMIZI', O.kirmizi], ['MAVI', O.mavi]]) {
    if (!arr.length) continue;
    const d = ort(arr.map(o => o.dost)), e = ort(arr.map(o => o.dus));
    const ustun = arr.filter(o => o.dost > o.dus).length;
    yaz('  ' + ad.padEnd(10) + String(arr.length).padStart(6) + d.toFixed(1).padStart(8) +
        e.toFixed(1).padStart(8) + (e ? (d / e).toFixed(2) : '-').padStart(8) +
        ort(arr.map(o => o.derinlik)).toFixed(2).padStart(10) +
        ('  %' + Math.round(ustun / arr.length * 100)).padStart(20));
}
yaz('');
yaz('  ══ KUTLENIN KONUMU (5sn ornekleme) ══');
yaz('  ' + 'taraf'.padEnd(10) + 'derinlik'.padStart(10) + 'derinlik-sd'.padStart(13) + 'yayilim(px)'.padStart(13));
for (const [ad, arr] of [['KIRMIZI', K.kirmizi], ['MAVI', K.mavi]]) {
    if (!arr.length) continue;
    yaz('  ' + ad.padEnd(10) + ort(arr.map(k => k.derinlik)).toFixed(2).padStart(10) +
        ort(arr.map(k => k.derinlikSd)).toFixed(2).padStart(13) +
        Math.round(ort(arr.map(k => k.yayilim))).toString().padStart(13));
}
yaz('');
yaz('  ══ AYRISMA: kutle nerede vs olum nerede ══');
for (const [ad, o, k] of [['KIRMIZI', O.kirmizi, K.kirmizi], ['MAVI', O.mavi, K.mavi]]) {
    if (!o.length || !k.length) continue;
    yaz('  ' + ad.padEnd(10) + 'kutle derinlik ' + ort(k.map(x => x.derinlik)).toFixed(2) +
        '   olum derinlik ' + ort(o.map(x => x.derinlik)).toFixed(2) +
        '   fark ' + (ort(o.map(x => x.derinlik)) - ort(k.map(x => x.derinlik))).toFixed(2) +
        '  (olumler kutlenin ILERISINDE ise +)');
}
yaz('');
yaz('  KIYAS — localRatio teshisi (zirhli, gecmis): 4.0 dost / 12.3 dusman, derinlik 0.44-0.47');
fs.writeFileSync(path.join(__dirname, '..', 'qa-runtime', 'kuvvet-dagilimi.json'),
    JSON.stringify({ olumler: O, kutle: K }, null, 1));
