// RADAR GORUS TESHISI (kullanici: "radar acikken sag-alt haritada dusmanin TAMAMI gorunuyor;
// yalniz HAVA birimleri gorunmeli").
//
// TOGGLE BAGLIYOR MU? (OLCUM-TUZAKLARI #3) — bu arac kurali dogrudan sinar:
//   1. Sahaya bir hava-arama radari (counter_battery_radar) koyar, BASKA hicbir dost birim birakmaz.
//   2. Radarin gorus dairesi icine bir KARA ve bir HAVA dusman birimi koyar.
//   3. canSee + battleUnitVisibleToViewer + battleRadarOnlyContact ciktisini yazar.
// BEKLENEN: kara GORUNMEZ, hava GORUNUR ve "radar temasi" (kirmizi isaret) olarak isaretlenir.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

const { ctx } = tezgahKur();

const kod = [
    '(() => {',
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:202, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    'startBattle();',
    'SIM.headless = true;',
    'SIM.units.length = 0;',   // temiz saha: yalnÄ±z deneyin birimleri
    // MAVI (izleyici) tarafinda TEK birim: hava-arama radari
    'let radarTip = null; for (const k in STATS) if (STATS[k] && STATS[k].airRadar) { radarTip = Number(k); break; }',
    'if (radarTip == null) return JSON.stringify({ hata: "airRadar tasiyan tip yok" });',
    'const radar = new Unit(radarTip, 2000, 2000, false);',
    'SIM.units.push(radar);',
    // KIRMIZI hedefler: radarin dibinde bir kara + bir hava birimi
    'let karaTip = null, havaTip = null;',
    'for (const k in STATS) { const s = STATS[k]; if (!s) continue;',
    '  if (karaTip == null && s.domain !== "air" && s.armorType === "heavy") karaTip = Number(k);',
    '  if (havaTip == null && s.domain === "air" && !s.singleUse) havaTip = Number(k); }',
    'const kara = new Unit(karaTip, 2150, 2000, true); const hava = new Unit(havaTip, 2300, 2000, true);',
    'SIM.units.push(kara, hava);',
    'const gorus = Number.isFinite(radar.vision) ? radar.vision : STATS[radarTip].vision;',
    'return JSON.stringify({',
    '  radarTip: STATS[radarTip].id, gorus: gorus,',
    '  statsBayrak: !!STATS[radarTip].airRadar, ornekBayrak: !!radar.airRadar,',
    '  karaTip: STATS[karaTip].id, havaTip: STATS[havaTip].id,',
    '  karaMesafe: Math.round(Math.hypot(kara.x - radar.x, kara.y - radar.y)),',
    '  havaMesafe: Math.round(Math.hypot(hava.x - radar.x, hava.y - radar.y)),',
    '  karaGorunur: battleUnitVisibleToViewer(kara, false, PHASE.BATTLE),',
    '  havaGorunur: battleUnitVisibleToViewer(hava, false, PHASE.BATTLE),',
    '  karaRadarTemasi: battleRadarOnlyContact(kara, false),',
    '  havaRadarTemasi: battleRadarOnlyContact(hava, false)',
    '});',
    '})()'
].join('\n');

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'radarteshis.js' }));
console.log('\nRADAR GORUSU — TEK RADAR, BASKA GOZ YOK');
console.log('  radar          : ' + r.radarTip + '  gorus ' + r.gorus + 'px');
console.log('  airRadar bayragi: STATS=' + r.statsBayrak + '  Unit ornegi=' + r.ornekBayrak +
    (r.ornekBayrak ? '' : '   <- ornege KOPYALANMIYOR (kok neden buydu; canSee artik STATS e bakiyor)'));
console.log('  KARA hedef (' + r.karaTip + ', ' + r.karaMesafe + 'px): gorunur=' + r.karaGorunur +
    '   BEKLENEN false  ' + (r.karaGorunur ? '*** KUSUR ***' : 'OK'));
console.log('  HAVA hedef (' + r.havaTip + ', ' + r.havaMesafe + 'px): gorunur=' + r.havaGorunur +
    '   BEKLENEN true   ' + (r.havaGorunur ? 'OK' : '*** KUSUR ***'));
console.log('  radar-temasi (kirmizi isaret): kara=' + r.karaRadarTemasi + '  hava=' + r.havaRadarTemasi +
    '   BEKLENEN false/true  ' + (!r.karaRadarTemasi && r.havaRadarTemasi ? 'OK' : '*** KUSUR ***'));
