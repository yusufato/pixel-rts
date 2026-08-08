// GAFIL AVLAMA TESHISI — kullanicinin tarif ettigi dongu olculur.
//
// KULLANICI (2026-08-08): "benim bir anda yogunlasma sebebim HIZLI HAREKET etmem; tek basina gezen
// bir birligi GAFIL AVLAMAK gibi. Once hedef sec, dogru ani bekle, kisa bir taarruzla hedefi indir,
// geri cekil veya savasmaya devam et."
//
// BU, OLCUMLE BIREBIR UYUSUYOR: temas aninda oyuncunun cevresinde 1.2 dusman, AI'da 3.4 (dost sayisi
// benzer: 8.9 vs 6.9). Yani oyuncu YAYILDIGI icin degil, YALNIZ KALANI sectigi icin ustun.
// Ayrica daha once denenen "aktif toplanma" mudahalesinin neden basarisiz oldugunu da aciklar:
// ana kutleye yiginca dusmanin ana kutlesi de geliyor -> oran SABIT kaliyor.
//
// OLCULEN (oldurme anlarinda, olay izlemesi — sayac degil):
//   KURBANIN YALNIZLIGI : olen dusmanin R icindeki KENDI dostlari (kac kisiydi yaninda)
//   SALDIRAN USTUNLUGU  : olduren tarafin R icindeki dostlari
//   YEREL ORAN          : saldiran dostu / (kurban dostu + 1)
// "Gafil avlama" = kurban yalniz (<=1 dostu) VE saldiran kalabalik (>=3).
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 6)) || 6);
const R = Math.max(100, Number(arg('--r', 600)) || 600);   // yerel cember (600px = balistigin ayak izi)
const HAVUZ = [202, 2024, 3141, 777, 11, 333, 4001, 4003];
const TOHUMLAR = HAVUZ.slice(0, N);

const { ctx } = tezgahKur();

function kos(seed) {
    const kod = [
        '(() => {',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"ga", ally:true });',
        'startBattle();',
        'const R = ' + R + ';',
        'const olum = [];',
        'const onceki = new Map();',   // id -> {x,y,isRed,tip}
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        // olmeden ONCEKI konumu sakla (olen birim listeden silinir)
        '  for (const u of SIM.units) if (!u.dead) onceki.set(u.id, { x: u.x, y: u.y, isRed: !!u.isRed, tip: (STATS[u.type]||{}).id });',
        '  const oncekiCanli = new Set(SIM.units.filter(u => !u.dead).map(u => u.id));',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '  const simdiCanli = new Set(SIM.units.filter(u => !u.dead).map(u => u.id));',
        '  for (const id of oncekiCanli) {',
        '    if (simdiCanli.has(id)) continue;',
        '    const k = onceki.get(id); if (!k) continue;',
        // kurbanin son konumunda: kendi dostlari ve dusmanlari
        '    let kurbanDost = 0, saldiranDost = 0;',
        '    for (const v of SIM.units) {',
        '      if (v.dead || v.loaded || v.id === id) continue;',
        '      if (Math.hypot(v.x - k.x, v.y - k.y) > R) continue;',
        '      if (!!v.isRed === k.isRed) kurbanDost++; else saldiranDost++;',
        '    }',
        '    olum.push({ kirmiziKurban: k.isRed, tip: k.tip, kurbanDost, saldiranDost });',
        '  }',
        '} } finally { SIM.headless = ph; }',
        'return JSON.stringify(olum);',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'ga.js' }));
}

let hepsi = [];
for (const s of TOHUMLAR) hepsi = hepsi.concat(kos(s));

console.log('GAFIL AVLAMA TESHISI — ' + TOHUMLAR.length + ' mac, cember ' + R + 'px');
console.log('  kullanicinin dongusu: hedef sec -> ani bekle -> kisa taarruz -> cekil/devam');
console.log('  olculmus insan profili: vurulurken 8.9 dost / 1.2 dusman (AI 6.9 / 3.4)');
console.log('');
console.log('  toplam olum: ' + hepsi.length);
if (!hepsi.length) { console.log('  olum yok'); process.exit(0); }

const ort = (f) => (hepsi.reduce((a, x) => a + f(x), 0) / hepsi.length);
console.log('  ORTALAMA — kurbanin yanindaki KENDI dostu : ' + ort(x => x.kurbanDost).toFixed(2));
console.log('  ORTALAMA — kurbanin yanindaki DUSMAN      : ' + ort(x => x.saldiranDost).toFixed(2));
console.log('');
// DAGILIM: kurban ne kadar yalnizdi?
const kova = { 'yalniz (0-1 dost)': 0, 'kucuk grup (2-3)': 0, 'kutle (4+)': 0 };
for (const o of hepsi) {
    if (o.kurbanDost <= 1) kova['yalniz (0-1 dost)']++;
    else if (o.kurbanDost <= 3) kova['kucuk grup (2-3)']++;
    else kova['kutle (4+)']++;
}
console.log('  KURBANIN YALNIZLIK DAGILIMI:');
for (const [k, v] of Object.entries(kova))
    console.log('    ' + k.padEnd(20) + String(v).padStart(6) + '  (%' + Math.round(v / hepsi.length * 100) + ')');
console.log('');
// GAFIL AVLAMA: kurban yalniz VE saldiran kalabalik
const gafil = hepsi.filter(o => o.kurbanDost <= 1 && o.saldiranDost >= 3).length;
const kotu = hepsi.filter(o => o.kurbanDost >= 4).length;
console.log('  GAFIL AVLAMA (kurban <=1 dost VE saldiran >=3): ' + gafil + '  (%' + Math.round(gafil / hepsi.length * 100) + ')');
console.log('  KUTLE ICINDE OLUM (kurbanin >=4 dostu vardi)   : ' + kotu + '  (%' + Math.round(kotu / hepsi.length * 100) + ')');
console.log('');
console.log('  OKUMA: "gafil avlama" orani DUSUKSE, AI yalniz kalani avlamiyor demektir —');
console.log('         kullanicinin ustunlugunun kaynagi tam da bu. Mudahale bu orani yukseltmeli.');
