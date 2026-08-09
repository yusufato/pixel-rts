// HAVA SAVUNMA PAYI TARAMASI — AI daha cok AD alirsa helo kaybi duser mi, marj ne olur?
//
// NEDEN BU KALDIRAC: iki konumlandirma hipotezi de OLCULDU ve CURUDU —
//   (1) AD'yi one surmek ('adUmbrella'): 48 mac, marj t=0.20, AD sagkalimi −6.9 puan (KOTU).
//   (2) "birimler semsiyeden cikiyor": helo kurbani %23.1 vs taban %22.5 → FARK YOK.
// Kalan olcum: AD ates ediyor ama oldurmuyor (26 gercek macta 149 isabet → 29 helodan 6 olum)
// ve helo olumlerinin %28'i AI'in HIC AD'si kalmamisken oluyor. Denge SABIT (kullanici kurali)
// → AI'in kendi elindeki tek kaldirac ADET.
//
// TARAF-BASI: carpan YALNIZ KIRMIZIDA acilir (BATTLE_AD_WEIGHT_MULT_RED). Ilk surum GLOBAL'di —
// iki taraf da ayni orduyu aliyordu, marj simetrik olarak sifirlaniyordu ve kaldiracin MAC DEGERI
// olculemiyordu; kosu iptal edilip taraf-basi yapildi. Kapsam manpads_team'i de icerir (vurus
// aninda en yakin AD 107 vakanin 59'unda manpads'ti).
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N_MAC = Math.max(1, Number(arg('--mac', 12)) || 12);
const CARPANLAR = (arg('--carpan', '1,1.5,2')).split(',').map(Number);
const HAVUZ = []; for (let i = 0; i < 128; i++) HAVUZ.push(100000 + i * 197);
const TOHUMLAR = HAVUZ.slice(0, N_MAC);
const yaz = (s) => { try { fs.writeSync(1, s + '\n'); } catch (e) { console.log(s); } };
const { ctx } = tezgahKur();

function kos(seed, kirmiziSaldiran, carpan) {
    const kod = `(() => {
    BATTLE_RECIPE_RED = null;
    BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
    BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;
    BATTLE_INTEL4PRO_DELTAS_RED = null; BATTLE_INTEL4PRO_DELTAS_BLUE = null;
    BATTLE_AD_WEIGHT_MULT_RED = ${carpan}; BATTLE_AD_WEIGHT_MULT_BLUE = 1;   // TARAF-BASI: yalniz kirmizi
    if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${seed}, attackerSide:${kirmiziSaldiran},
        durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
    battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
        brainIntel4:true, isAttacker:${!kirmiziSaldiran}, pro:true }), false, { source:'adp', ally:true });
    startBattle();
    // AD SAYIMI kapsamla TUTARLI olmali: kategori air_defense + hava silahi tasiyan piyade (manpads).
    // Ilk surum yalniz kategoriye bakiyordu → manpads'i guclendirip saymiyordu (tutarsiz tablo).
    const adBirimMi = (u) => { const s = STATS[u.type]; if (!s) return false;
        if (s.category === 'air' || s.category === 'uav') return false;
        return s.category === 'air_defense' ||
            (s.weapons||[]).some(w => Array.isArray(w.targets) && w.targets.includes('air')); };
    const adBaslangic = SIM.units.filter(u => u.isRed && !u.dead && adBirimMi(u)).length;
    const kirmiziBaslangic = SIM.units.filter(u => u.isRed && !u.dead).length;
    const ph = SIM.headless; SIM.headless = true; let st = 0;
    let havaOlum = 0, havaOlumDeger = 0, toplamOlumDeger = 0, dusHavaOlum = 0, sonSeq = -1;
    let adYokOrnek = 0, adOrnek = 0;
    const havaMi = (t) => { const s = STATS[t]; return !!(s && (s.category === 'air' || s.category === 'uav')); };
    const bosalt = () => {
        if (typeof BATTLE_FORENSIC === 'undefined') return;
        for (const ev of BATTLE_FORENSIC.buf) {
            if (ev.seq <= sonSeq) continue; sonSeq = ev.seq;
            const dg = (STATS[ev.targetType] && STATS[ev.targetType].cost) || 0;
            if (ev.targetSide === 'red' && ev.lethal) {
                toplamOlumDeger += dg;
                if (havaMi(ev.attackerType)) { havaOlum++; havaOlumDeger += dg; }
            } else if (ev.targetSide === 'blue' && ev.lethal && havaMi(ev.targetType) && ev.attackerSide === 'red') dusHavaOlum++;
        }
    };
    try {
        while (SIM.tick < 7300 && phase === PHASE.BATTLE) {
            st += BATTLE_TICK_MS;
            stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
            if (typeof updateSupport === 'function') updateSupport(BATTLE_TICK_SEC, st);
            if (SIM.tick % 10 !== 0) continue;
            bosalt();
            adOrnek++;
            const ad = SIM.units.filter(u => u.isRed && !u.dead && adBirimMi(u)).length;
            if (!ad) adYokOrnek++;
        }
    } finally { SIM.headless = ph; }
    bosalt();
    const oK = battleArmyObservation(true), oM = battleArmyObservation(false);
    return JSON.stringify({ marj: Math.round(oK.effectiveValue - oM.effectiveValue),
        adBaslangic, kirmiziBaslangic, havaOlum, havaOlumDeger, toplamOlumDeger, dusHavaOlum,
        adYokPay: adOrnek ? adYokOrnek / adOrnek : 0 });
})()`;
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'adp.js' }));
}

yaz('HAVA SAVUNMA PAYI TARAMASI — BATTLE_AD_WEIGHT_MULT');
yaz('  ' + TOHUMLAR.length + ' tohum x 2 rol x ' + CARPANLAR.length + ' carpan = ' + (TOHUMLAR.length * 2 * CARPANLAR.length) + ' mac');
yaz('  TABAN: AD agirligi 0.155 · gercek maclarda AD ort 2.5/27 birim · helo olumlerinin %28 i AD YOKKEN');
yaz('');
const S = {};
for (const c of CARPANLAR) S[c] = [];
for (let i = 0; i < TOHUMLAR.length; i++) {
    for (const kS of [true, false]) {
        const sat = [];
        for (const c of CARPANLAR) { const r = kos(TOHUMLAR[i], kS, c); S[c].push(r); sat.push(c + ':' + r.adBaslangic + 'AD/' + r.marj); }
        yaz('  [' + (i + 1) + '/' + TOHUMLAR.length + '] ' + TOHUMLAR[i] + ' ' + (kS ? 'SALD' : 'SAVU') + '   ' + sat.join('  '));
        fs.writeFileSync(path.join(__dirname, '..', 'qa-runtime', 'ad-payi-ARA.json'), JSON.stringify(S, null, 1));
    }
}
const ort = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const oranTop = (arr, p, q) => { const P = arr.reduce((s, r) => s + r[p], 0), Q = arr.reduce((s, r) => s + r[q], 0); return Q ? P / Q : 0; };
yaz('');
yaz('  ' + 'carpan'.padEnd(8) + 'AD adet'.padStart(9) + 'ordu'.padStart(7) + 'hava-olum'.padStart(11) +
    'hava-pay%'.padStart(11) + 'AD-yok%'.padStart(9) + 'dusurulen'.padStart(11) + 'marj'.padStart(9) + 't(vs 1)'.padStart(9));
const taban = S[CARPANLAR[0]];
for (const c of CARPANLAR) {
    const a = S[c];
    let tStr = '-';
    if (c !== CARPANLAR[0]) {
        const f = a.map((r, i) => r.marj - taban[i].marj);
        const o = ort(f), sd = Math.sqrt(f.reduce((x, y) => x + (y - o) ** 2, 0) / Math.max(1, f.length - 1));
        const se = sd / Math.sqrt(f.length);
        tStr = se ? (o / se).toFixed(2) : '-';
    }
    yaz('  ' + String(c).padEnd(8) + ort(a.map(r => r.adBaslangic)).toFixed(1).padStart(9) +
        ort(a.map(r => r.kirmiziBaslangic)).toFixed(1).padStart(7) +
        ort(a.map(r => r.havaOlum)).toFixed(1).padStart(11) +
        (oranTop(a, 'havaOlumDeger', 'toplamOlumDeger') * 100).toFixed(1).padStart(11) +
        (ort(a.map(r => r.adYokPay)) * 100).toFixed(1).padStart(9) +
        ort(a.map(r => r.dusHavaOlum)).toFixed(1).padStart(11) +
        Math.round(ort(a.map(r => r.marj))).toString().padStart(9) + tStr.padStart(9));
}
yaz('');
yaz('  NOT: carpan YALNIZ KIRMIZIDA → marj farki gercek kaldirac degeridir. Mekanizma sutunlari');
yaz('       (hava-olum / hava-pay / AD-yok) mekanizmanin CALISTIGINI, marj ISE YARADIGINI gosterir.');
fs.writeFileSync(path.join(__dirname, '..', 'qa-runtime', 'ad-payi.json'), JSON.stringify(S, null, 1));
