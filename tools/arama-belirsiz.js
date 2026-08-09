// SEARCH/UNCERTAIN A/B — korlukte kesfe cikmak ise yariyor mu?
//
// TESHIS (26 gercek mac, 10952 karar, tools/situation-kapsama.js zinciri):
//   contactState UC degerli (CONTACT / UNCERTAIN / NO_CONTACT) ama SEARCH puanlamasi IKI degerliydi:
//   `NO_CONTACT ? +30 : -50` → UNCERTAIN tam gorusle ayni cezayi aliyordu.
//   Sonuc: UNCERTAIN'de SEARCH orani **%0.0** (1025 kararin hicbirinde). AI gorusu kaybedince
//   HOLD %45 + hatirladigi konuma ates hazirligi %42 yapiyor, tekrar temas kurmaya CALISMIYOR.
//
// MEKANIZMA METRIGI (mac sonucu DEGIL):
//   S1 UNCERTAIN'de SEARCH secilme orani  (taban %0.0 — sifirdan cikmali)
//   S2 UNCERTAIN'de gecen sure           (kesif ise yararsa korluk KISALMALI)
//   S3 CONTACT orani                     (temasta gecen sure ARTMALI)
//   BAGLANMA: BATTLE_BALANCE.searchUncertainBind
// TARAF-BASI: bayrak global oldugu icin A/B iki kolu AYRI KOSU olarak alir (mavi de etkilenir);
//   bu yuzden marj farki SIMETRIK etkiyi olcer — mekanizma metrigi asil kanittir.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N_MAC = Math.max(1, Number(arg('--mac', 12)) || 12);
const ROL = arg('--rol', 'her');
const TABAN = Number(arg('--taban', 38)) || 38;   // BATTLE_SEARCH_UNCERTAIN_BASE taramasi
const HAVUZ = []; for (let i = 0; i < 128; i++) HAVUZ.push(100000 + i * 181);
const TOHUMLAR = HAVUZ.slice(0, N_MAC);
const yaz = (s) => { try { fs.writeSync(1, s + '\n'); } catch (e) { console.log(s); } };
const { ctx } = tezgahKur();

function kos(seed, kirmiziSaldiran, acik) {
    const kod = `(() => {
    BATTLE_RECIPE_RED = null;
    BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
    BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;
    BATTLE_INTEL4PRO_DELTAS_RED = null; BATTLE_INTEL4PRO_DELTAS_BLUE = null;
    BATTLE_SEARCH_UNCERTAIN = ${acik};
    BATTLE_SEARCH_UNCERTAIN_BASE = ${TABAN};
    if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
    if (typeof BATTLE_BALANCE !== 'undefined') { BATTLE_BALANCE.on = true; BATTLE_BALANCE.searchUncertainBind = 0; }
    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${seed}, attackerSide:${kirmiziSaldiran},
        durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
    battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
        brainIntel4:true, isAttacker:${!kirmiziSaldiran}, pro:true }), false, { source:'ab', ally:true });
    startBattle();
    const ph = SIM.headless; SIM.headless = true; let st = 0;
    const durum = { CONTACT:0, UNCERTAIN:0, NO_CONTACT:0 };
    const aramaDurum = { CONTACT:0, UNCERTAIN:0, NO_CONTACT:0 };
    let karar = 0;
    try {
        while (SIM.tick < 7300 && phase === PHASE.BATTLE) {
            st += BATTLE_TICK_MS;
            stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
            if (typeof updateSupport === 'function') updateSupport(BATTLE_TICK_SEC, st);
            if (SIM.tick % 20 !== 0) continue;
            const c = [...BATTLE_CONTROLLERS.values()].find(x => x.side === true);
            if (!c || !c.lastSituation) continue;
            const cs = c.lastSituation.contactState;
            if (durum[cs] === undefined) continue;
            karar++; durum[cs]++;
            const pk = c.currentPlan && c.currentPlan.kind;
            if (pk === BATTLE_PLAN_KIND.SEARCH) aramaDurum[cs]++;
        }
    } finally { SIM.headless = ph; }
    const oK = battleArmyObservation(true), oM = battleArmyObservation(false);
    return JSON.stringify({ marj: Math.round(oK.effectiveValue - oM.effectiveValue), karar, durum, aramaDurum,
        bind: (typeof BATTLE_BALANCE !== 'undefined' ? (BATTLE_BALANCE.searchUncertainBind||0) : 0) });
})()`;
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'ab.js' }));
}

const roller = ROL === 'her' ? [true, false] : [ROL === 'saldiran'];
yaz('SEARCH/UNCERTAIN A/B — bayrak BATTLE_SEARCH_UNCERTAIN');
yaz('  ' + TOHUMLAR.length + ' tohum x ' + roller.length + ' rol x 2 kol = ' + (TOHUMLAR.length * roller.length * 2) + ' mac');
yaz('  TABAN (26 gercek mac): UNCERTAIN kararlarinin %0.0 inda SEARCH secilmis (1025 karar)');
yaz('  BATTLE_SEARCH_UNCERTAIN_BASE = ' + TABAN);
yaz('');
const K = { kapali: [], acik: [] };
for (let i = 0; i < TOHUMLAR.length; i++) {
    for (const kS of roller) {
        const a = kos(TOHUMLAR[i], kS, false), b = kos(TOHUMLAR[i], kS, true);
        K.kapali.push(a); K.acik.push(b);
        const o = (r) => r.durum.UNCERTAIN ? Math.round(r.aramaDurum.UNCERTAIN / r.durum.UNCERTAIN * 100) : 0;
        yaz('  [' + (i + 1) + '/' + TOHUMLAR.length + '] ' + TOHUMLAR[i] + ' ' + (kS ? 'SALD' : 'SAVU') +
            '  UNC-arama ' + o(a) + '% -> ' + o(b) + '%   marj ' + a.marj + ' -> ' + b.marj + '   bind ' + b.bind);
        fs.writeFileSync(path.join(__dirname, '..', 'qa-runtime', 'arama-belirsiz-ARA.json'), JSON.stringify(K, null, 1));
    }
}
const ort = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const topOran = (arr, f, g) => { const P = arr.reduce((s, r) => s + f(r), 0), Q = arr.reduce((s, r) => s + g(r), 0); return Q ? P / Q * 100 : 0; };
yaz('');
yaz('  ══ BAGLANMA ══  acik ' + K.acik.reduce((s, r) => s + r.bind, 0) +
    ' (bind>0 mac ' + K.acik.filter(r => r.bind > 0).length + '/' + K.acik.length + ')' +
    '   kapali ' + K.kapali.reduce((s, r) => s + r.bind, 0) + ' (0 olmali)');
yaz('');
yaz('  ' + 'metrik'.padEnd(34) + 'KAPALI'.padStart(10) + 'ACIK'.padStart(10) + 'fark'.padStart(10));
const satir = (ad, f) => { const a = f(K.kapali), b = f(K.acik); yaz('  ' + ad.padEnd(34) + a.toFixed(1).padStart(10) + b.toFixed(1).padStart(10) + (b - a).toFixed(1).padStart(10)); };
satir('S1 UNCERTAIN de SEARCH %', arr => topOran(arr, r => r.aramaDurum.UNCERTAIN, r => r.durum.UNCERTAIN));
satir('S2 UNCERTAIN de gecen sure %', arr => topOran(arr, r => r.durum.UNCERTAIN, r => r.karar));
satir('S3 CONTACT ta gecen sure %', arr => topOran(arr, r => r.durum.CONTACT, r => r.karar));
satir('   NO_CONTACT %', arr => topOran(arr, r => r.durum.NO_CONTACT, r => r.karar));
const fark = K.acik.map((b, i) => b.marj - K.kapali[i].marj);
const o = ort(fark), sd = Math.sqrt(fark.reduce((a, b) => a + (b - o) ** 2, 0) / Math.max(1, fark.length - 1));
const se = sd / Math.sqrt(fark.length);
yaz('');
yaz('  ══ MAC KAPISI (' + fark.length + ' mac) ══  ort ' + Math.round(o) + '  se ' + Math.round(se) + '  t ' + (se ? (o / se).toFixed(2) : '-'));
fs.writeFileSync(path.join(__dirname, '..', 'qa-runtime', 'arama-belirsiz.json'), JSON.stringify(K, null, 1));
