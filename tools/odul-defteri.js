// BIRIM ODUL DEFTERI — "her birimin kendi odul mekanizmasi olmali" (kullanici)
//
// NEDEN: tek bir `getiri` (imha degeri / maliyet) lensi bu oturumda UC KEZ yanlis hedef gosterdi:
//   topcu x0.21 ("verimsiz" -> aslinda urunu PANIK), kesif x0 (urunu GORUS), IFV x0.05 (orduDAN
//   CIKARINCA sonuc KOTULESTI). Her birimin isi farkliysa odulu de farkli olmali.
//
// Defter (globals.js: BATTLE_CREDIT) her birime KENDI isini yazar:
//   hasar / panik / baski / imhaDeger / emilen   -> motorun hit-cozucusunden (atif ATISI YAPANA)
//   siperTik                                     -> istihkam: kurdugu siperde gecen DOST-tik
//   yakitDolum                                   -> istihkam: kurdugu uste yapilan helo dolumu
//   gorusTekil                                   -> kesif: YALNIZ o birim sayesinde gorulen dusman
// Bu arac tik-basi orneklemeyi kendisi yapar (motor dongusune dokunmaz -> determinizm korunur).
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const { ctx } = tezgahKur();

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const _si = process.argv.indexOf('--seeds');
const TOHUMLAR = _si >= 0 ? process.argv[_si + 1].split(',').map(Number) : [2024, 3141, 777, 11, 202, 333];
const ORNEK = Math.max(1, Number(arg('--ornek', 10)) || 10);   // kac tikte bir uzamsal ornekleme
// ZORUNLU: nadir birimleri GERCEKCI bir ordunun icine 1-2 adet sok (tuzak A2: hepsini birden
// zorlamak "her tipten bir tane" uretir, kutle olmaz ve HER birim bozuk gorunur).
const _zi = process.argv.indexOf('--zorunlu');
const ZORUNLU = _zi >= 0 ? process.argv[_zi + 1].split(',').filter(Boolean) : [];
const OUT = arg('--out', '');
// DUSMAN HAVA: hava savunmasini (manpads/SAM/spaag) ADIL sinamak icin dusmana ucak ver.
// Dogal maclarda dusmanin YALNIZ 1 hava birimi var ve AA menziline hic girmiyor -> HAVA kanali
// bos kaliyor ve AA birimleri haksiz yere "supheli" cikiyor.
const DUSMAN_HAVA = process.argv.includes('--dusmanhava');
const fs = require('fs');
const GERCEKCI_TABAN = ZORUNLU.length ? JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8')) : null;
const TARIF = ZORUNLU.length ? Object.assign({ ad: 'ODUL', rol: 'attacker', zorunlu: {}, tavan: {}, artik: [] }, GERCEKCI_TABAN) : null;
if (TARIF) for (const id of ZORUNLU) TARIF.zorunlu[id] = (id === 'transport_helo' || id === 'mlrs') ? 2 : 1;

const kod = [
    '(() => {',
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
    'const top = {};',
    'let macSay = 0;',
    'for (const seed of ' + JSON.stringify(TOHUMLAR) + ') {',
    '  BATTLE_RECIPE_RED = ' + JSON.stringify(TARIF) + ';',
    (DUSMAN_HAVA
        ? '  BATTLE_RECIPE_BLUE = { ad:"HAVA-RAKIP", rol:"defender", zorunlu:{ attack_helo:2, armed_uav:2 }, tavan:{}, artik:[] };'
        : '  BATTLE_RECIPE_BLUE = null;'),
    '  openBattlefieldSession({ mode:"quick", mapId:-2, seed, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    '  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"od", ally:true });',
    '  startBattle();',
    '  BATTLE_CREDIT.on = true; battleKrediSifirla();',
    '  const _gorulen = new Set();',
    '  for (const u of SIM.units) battleKrediKayit(u);',
    '  const ph = SIM.headless; SIM.headless = true; let st = 0;',
    '  try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
    '    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
    '    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
    '    if (SIM.tick % ' + ORNEK + ') continue;',
    // ── SIPER DOLULUGU: kurdugu siperde duran DOST-tik istihkama yazilir
    '    for (const t of SIM.trenches) {',
    '      if (t.builderId == null) continue;',
    '      const b = SIM.units.find(z => z.id === t.builderId); if (!b) continue;',
    '      let ic = 0;',
    '      for (const u of SIM.units) { if (u.dead || u.loaded || u.isRed !== t.isRed) continue;',
    '        if (Math.hypot(u.x - t.x, u.y - t.y) <= t.r) ic++; }',
    '      if (ic) battleKredi(b, "siperTik", ic * ' + ORNEK + ');',
    '    }',
    // ── GORUS KREDISI (PAYLASILAN): "yalniz o gordu" olcusu COK KATI cikti — 16 birimlik orduda
    // neredeyse hic gerceklesmiyor ve tum birimler 0.00 veriyordu (olculdu). Yerine: bir dusmani
    // goren her dost 1/N pay alir. Uzaga giden tek kesif buyuk pay, kutledeki 10 birim kucuk pay.
    '    for (const e of SIM.units) {',
    '      if (e.dead || e.loaded || e.isRed) continue;',
    '      const gorenler = [];',
    '      for (const u of SIM.units) {',
    '        if (u.dead || u.loaded || !u.isRed) continue;',
    '        const vr = (Number.isFinite(u.vision) ? u.vision : (STATS[u.type]||{}).vision || 0) * TILE_PX;',
    '        if (vr && Math.hypot(u.x - e.x, u.y - e.y) <= vr) gorenler.push(u);',
    '      }',
    '      if (!gorenler.length) continue;',
    '      const pay = ' + ORNEK + ' / gorenler.length;',
    '      for (const g of gorenler) battleKredi(g, "gorusTekil", pay);',
    '      if (!_gorulen.has(e.id)) { _gorulen.add(e.id);',
    '        for (const g of gorenler) battleKredi(g, "tespit", 1 / gorenler.length); }',   // ILK tespit payi
    '    }',
    // ── HAVA CAYDIRMA: dusman HAVA birimi, benim hava-savunma menzilimde gecirdigi her tik.
    // Manpads/SAM'in urunu dusurdugu ucak DEGIL, dusmanin havayi kullanamamasidir.
    '    for (const e of SIM.units) {',
    '      if (e.dead || e.loaded || e.isRed || !e.isAir) continue;',
    '      for (const u of SIM.units) {',
    '        if (u.dead || u.loaded || !u.isRed) continue;',
    '        const w = (STATS[u.type] || {}).weapons;',
    '        if (!w || !w.some(x => x.targets && x.targets.includes("air"))) continue;',
    '        if (Math.hypot(u.x - e.x, u.y - e.y) <= u.range) battleKredi(u, "havaCaydirma", ' + "' + ORNEK + '" + ');',
    '      }',
    '    }',
    '  } } finally { SIM.headless = ph; }',
    // ── tip bazinda topla
    '  for (const id in BATTLE_CREDIT.birim) {',
    '    const r = BATTLE_CREDIT.birim[id];',
    '    if (!r.isRed) continue;',
    '    const ad = (STATS[r.tip] || {}).id || String(r.tip);',
    '    if (!top[ad]) top[ad] = { n:0, maliyet:r.maliyet, hasar:0, panik:0, baski:0, imhaDeger:0,',
    '      emilen:0, siperTik:0, yakitDolum:0, gorusTekil:0, tespit:0, jamTik:0, iyilestirme:0,',
    '      kurtarma:0, muhimmat:0, kuruEngel:0, tasinan:0, tasimaMesafe:0, droneHasar:0,',
    '      haleTik:0, rally:0, havaCaydirma:0, havaHasar:0, mayin:0 };',
    '    const a = top[ad]; a.n++;',
    '    a.hasar += r.hasar; a.panik += r.panik; a.baski += r.baski; a.imhaDeger += r.imhaDeger;',
    '    a.emilen += r.emilen; a.siperTik += r.siperTik; a.yakitDolum += r.yakitDolum;',
    '    a.gorusTekil += r.gorusTekil; a.tespit += r.tespit; a.jamTik += r.jamTik;',
    '    a.iyilestirme += r.iyilestirme; a.kurtarma += r.kurtarma; a.muhimmat += r.muhimmat;',
    '    a.kuruEngel += r.kuruEngel; a.tasinan += r.tasinan; a.tasimaMesafe += r.tasimaMesafe;',
    '    a.droneHasar += r.droneHasar; a.haleTik += r.haleTik; a.rally += r.rally;',
    '    a.havaCaydirma += r.havaCaydirma; a.havaHasar += r.havaHasar; a.mayin += r.mayin;',
    '  }',
    '  BATTLE_CREDIT.on = false; macSay++;',
    '  BATTLE_RECIPE_RED = null;',
    '}',
    'return JSON.stringify({ top, macSay });',
    '})()'
].join('');

const { top, macSay } = JSON.parse(vm.runInContext(kod, ctx, { filename: 'od.js' }));
if (OUT) { fs.writeFileSync(OUT, JSON.stringify({ top, macSay }, null, 1)); console.log('  -> ' + OUT); }
console.log('BIRIM ODUL DEFTERI — ' + macSay + ' mac, AI dogal ordusu');
console.log('  Her sutun BIRIM BASINA ve MALIYETE bolunmus: "1 TL karsiligi ne uretti".');
console.log('  imha = imha edilen dusman degeri | PANIK/BASKI = dusmana yazdirdigi moral hasari');
console.log('  emilen = ustune cektigi hasar | siper = kurdugu siperde gecen dost-saniye');
console.log('  dolum = kurdugu uste yapilan helo dolumu | GORUS = yalniz o sayede gorulen dusman-saniye');
console.log('');
// ── KANAL TANIMI: her birimin KENDI isi. `bol` = maliyete bolunsun mu (adil kiyas icin).
const KANAL = [
    { ad: 'imha/TL',  alan: 'imhaDeger',    bol: true,  k: 1,     w: 9 },
    { ad: 'hasar/TL', alan: 'hasar',        bol: true,  k: 1,     w: 9 },
    { ad: 'PANIK',    alan: 'panik',        bol: true,  k: 100,   w: 8 },
    { ad: 'BASKI',    alan: 'baski',        bol: true,  k: 100,   w: 8 },
    { ad: 'emilen',   alan: 'emilen',       bol: true,  k: 1,     w: 8 },
    { ad: 'GORUS',    alan: 'gorusTekil',   bol: true,  k: 0.05,  w: 7 },
    { ad: 'tespit',   alan: 'tespit',       bol: false, k: 1,     w: 7 },
    { ad: 'HAVA',     alan: 'havaCaydirma', bol: true,  k: 0.05,  w: 7 },
    { ad: 'havaHsr',  alan: 'havaHasar',    bol: true,  k: 1,     w: 9 },
    { ad: 'jam',      alan: 'jamTik',       bol: false, k: 0.05,  w: 6 },
    { ad: 'iyiles',   alan: 'iyilestirme',  bol: false, k: 1,     w: 8 },
    { ad: 'kurtar',   alan: 'kurtarma',     bol: false, k: 1,     w: 7 },
    { ad: 'muhim',    alan: 'muhimmat',     bol: false, k: 1,     w: 7 },
    { ad: 'kuruEng',  alan: 'kuruEngel',    bol: false, k: 1,     w: 8 },
    { ad: 'siper',    alan: 'siperTik',     bol: false, k: 0.05,  w: 7 },
    { ad: 'dolum',    alan: 'yakitDolum',   bol: false, k: 1,     w: 6 },
    { ad: 'mayin',    alan: 'mayin',        bol: false, k: 1,     w: 6 },
    { ad: 'tasinan',  alan: 'tasinan',      bol: false, k: 1,     w: 8 },
    { ad: 'droneHsr', alan: 'droneHasar',   bol: false, k: 1,     w: 9 },
    { ad: 'hale',     alan: 'haleTik',      bol: false, k: 0.05,  w: 6 },
    { ad: 'rally',    alan: 'rally',        bol: false, k: 1,     w: 6 },
];

const satir = Object.entries(top).map(([ad, a]) => {
    const o = { ad, mal: a.maliyet, n: a.n, v: {} };
    for (const c of KANAL) o.v[c.ad] = (a[c.alan] || 0) / a.n * c.k / (c.bol ? (a.maliyet || 1) : 1);
    return o;
});

// Sadece SIFIR OLMAYAN kanallar gosterilir (tablo okunabilir kalsin)
const aktif = KANAL.filter(c => satir.some(x => x.v[c.ad] > 0.005));
satir.sort((x, y) => (y.v['imha/TL'] || 0) - (x.v['imha/TL'] || 0));

console.log('  ' + 'birim'.padEnd(22) + 'TL'.padStart(6) + aktif.map(c => c.ad.padStart(c.w)).join(''));
for (const x of satir) {
    console.log('  ' + x.ad.padEnd(22) + String(x.mal).padStart(6) +
        aktif.map(c => {
            const v = x.v[c.ad];
            return (v > 0.005 ? (v >= 100 ? v.toFixed(0) : v.toFixed(2)) : '-').padStart(c.w);
        }).join(''));
}

// ── UZMANLIK: her birim HANGI kanalda one cikiyor (kanal-ici z-skoru) ──
// Sutunlar arasi kiyas YANLIS (birimleri farkli sey uretir); ayni sutunda birim-ici kiyas dogru.
console.log('');
console.log('  UZMANLIK — her birim kendi en guclu kanalinda (kanal-ici z-skoru):');
const zs = {};
for (const c of aktif) {
    const vals = satir.map(x => x.v[c.ad]);
    const m = vals.reduce((p, q) => p + q, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((p, q) => p + (q - m) * (q - m), 0) / vals.length) || 1;
    for (const x of satir) { (zs[x.ad] = zs[x.ad] || []).push({ kanal: c.ad, z: (x.v[c.ad] - m) / sd, v: x.v[c.ad] }); }
}
for (const x of satir) {
    const en = (zs[x.ad] || []).filter(q => q.v > 0.005).sort((a, b) => b.z - a.z).slice(0, 3);
    console.log('    ' + x.ad.padEnd(22) + (en.length
        ? en.map(q => q.kanal + ' (z' + (q.z >= 0 ? '+' : '') + q.z.toFixed(1) + ')').join('   ')
        : 'HICBIR KANALDA URETIM YOK  <-- bu birim ya olcusuz ya isesiz'));
}
console.log('');
console.log('  OKUMA: bir birimi tek sutunla yargilama. Sutunlar arasi kiyas da yapma —');
console.log('         topcunun BASKIsi ile tank avcisinin imhasi ayni para birimi degil.');
console.log('         Dogru kiyas: AYNI sutunda, birimler arasi (z-skoru bunu yapar).');
