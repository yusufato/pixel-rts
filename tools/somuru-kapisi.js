#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════════
   SOMURU KAPISI — "basit taktiklerle AI kandirilmasin" iddiasinin OLCULEBILIR hali

   KULLANICI HEDEFI: "oyuncular karsida gercek bir profesyonel komutan oldugunu dusunsun,
   basit taktiklerle AI'yi kandirip kendini avutamasinlar."
   Bu cumlenin olculebilir hali: DAR ve TEK SOMURULU botlardan olusan bir havuz var; her
   surumde kosar; AI bu havuza karsi tabanindan belirgin olcude kotulesirse SURUM GECMEZ.

   NEDEN AYRI BIR KAPI (ve neden mac marji DEGIL):
     · Mac marjinin std'si 2600-3800 -> n=128'de ancak ~700'luk etki gorulur, kapi 6 SAAT.
     · Somuru gucu ise DOGRUDAN olculur: "bot acikken AI'nin sagkalimi ne kadar dusuyor".
       Olculmus ornek: tek bir davranis botu AI sagkalimini %48.7 -> %36.4 dusurdu (12 puan).
       12 puanlik etki, 700 TL'lik marj etkisinden cok daha az tohum ister.
     · Yani bu kapi HEM daha keskin HEM daha ucuz, ve kullanicinin asil sorusunu soruyor.

   OLCUT — her somurucu icin ESLESTIRILMIS (ayni tohum, ayni ordu, tek fark bot):
       sagkalim(bot KAPALI) - sagkalim(bot ACIK)  =  SOMURU GUCU (puan)
   Buyuk deger = somuru guclu = AI o taktige karsi savunmasiz.

   HUKUM:
     ⛔ BAGLANMADI  : bot hic calismadi (bind=0) -> olcum ANLAMSIZ, kapi kirmizi
     ⛔ GERILEME    : somuru gucu tabandan saptama-tabani kadar ARTMIS -> SURUM GECMEZ
     ✅ GECTI       : gerileme yok
     ℹ  yeni taban  : --taban-yaz ile kaydedilir (docs/kayit/somuru-taban.json)

   ⚠ Somurucunun isi IYI OYNAMAK DEGIL, olculmus bir insan imzasini birebir tekrarlamak.
     Bir bot AI'yi yenemiyorsa bu da bilgidir ("o imza tek basina somuru degil").
   ═══════════════════════════════════════════════════════════════════════════════ */
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 8)) || 8);
const TOHUM0 = Number(arg('--tohum0', 160000)) || 160000;
const TABAN_YAZ = process.argv.includes('--taban-yaz');
/* ⚠ 'yerel_ustunluk' VARSAYILAN HAVUZDA DEGIL: kalibrasyon sinavini GECEMEDI
   (tools/somurucu-kalibrasyon.js). Insanin imzasi 7.4:1; bot en seciki halinde 3.11'e
   cikiyor ve o noktada AI'nin sagkalimi %4 -> %81 firliyor, yani bot maci hediye ediyor.
   Kalibre olmayan bota karsi alinan sonuc AI'i degil BOTU olcer. --havuz ile acikca
   istenirse kosar. */
const HAVUZ = String(arg('--havuz', 'helo_harass'))
    .split(',').map((x) => x.trim()).filter(Boolean);
const TABAN_YOL = path.join(__dirname, '..', 'docs', 'kayit', 'somuru-taban.json');

/* Her somurucunun ihtiyac duydugu ordu kosulu. helo_harass helo ISTER (yoksa bot hic
   baglamaz ve kapi bosuna kirmizi yanar); yerel_ustunluk genel bir kara davranisi. */
const TARIF_KOSUL = {
    helo_harass: { attack_helo: 3 },
    yerel_ustunluk: {}
};

const { ctx, hatalar } = tezgahKur();
const taban = JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));

function kos(seed, somuru, acik, aiSaldiran) {
    const zorunlu = Object.assign({}, taban.zorunlu, (acik && TARIF_KOSUL[somuru]) || {});
    const tarif = Object.assign({}, taban, { ad: 'SOMURU', zorunlu: zorunlu });
    const kod = '(() => {\n' +
'  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;\n' +
'  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;\n' +
'  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;\n' +
'  /* KIRMIZI = sinanan kod-AI · MAVI = somurucu bot. Bot yalniz ACIK kolda takilir. */\n' +
'  BATTLE_EXPLOITER_RED = null;\n' +
'  BATTLE_EXPLOITER_BLUE = ' + (acik ? JSON.stringify(somuru) : 'null') + ';\n' +
'  if (typeof BATTLE_BALANCE !== "undefined") {\n' +
'    BATTLE_BALANCE.on = true;\n' +
'    BATTLE_BALANCE.exploiterHeloBind = 0; BATTLE_BALANCE.exploiterYerelBind = 0;\n' +
'  }\n' +
'  BATTLE_RECIPE_BLUE = ' + JSON.stringify(tarif) + ';\n' +
'  BATTLE_RECIPE_RED = null;\n' +
'  openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ',\n' +
'    attackerSide:' + (aiSaldiran ? 'true' : 'false') + ',\n' +
'    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });\n' +
'  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;\n' +
'  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true,\n' +
'    varied:true, brainIntel4:true, isAttacker:' + (aiSaldiran ? 'false' : 'true') + ',\n' +
'    recipe: BATTLE_RECIPE_BLUE }), false, { source:"sk", ally:true });\n' +
'  startBattle(); SIM.headless = true;\n' +
'  BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false;\n' +
'\n' +
'  let kBas = 0, mBas = 0;\n' +
'  for (const u of SIM.units) {\n' +
'    const c = (STATS[u.type] && STATS[u.type].cost) || 0;\n' +
'    if (u.isRed) kBas += c; else mBas += c;\n' +
'  }\n' +
'  let st = 0;\n' +
'  while (phase === PHASE.BATTLE && SIM.tick < 7200) {\n' +
'    if (SIM.battle && SIM.battle.winnerSide !== null) break;\n' +
'    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);\n' +
'    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);\n' +
'  }\n' +
'  let kSon = 0, mSon = 0;\n' +
'  for (const u of SIM.units) {\n' +
'    if (u.dead || u.abandoned) continue;\n' +
'    const c = (STATS[u.type] && STATS[u.type].cost) || 0;\n' +
'    if (u.isRed) kSon += c; else mSon += c;\n' +
'  }\n' +
'  const B = (typeof BATTLE_BALANCE !== "undefined") ? BATTLE_BALANCE : {};\n' +
'  return JSON.stringify({\n' +
'    sagkalim: kBas ? kSon / kBas : 0,\n' +
'    marj: kSon - mSon,\n' +
'    bind: (B.exploiterHeloBind | 0) + (B.exploiterYerelBind | 0),\n' +
'    sure: Math.round(SIM.tick * 0.05) });\n' +
'})()';
    return JSON.parse(vm.runInContext(kod, ctx,
        { filename: 'sk-' + seed + '-' + somuru + '-' + (acik ? 'acik' : 'kapali') + '.js' }));
}

function istat(d) {
    const n = d.length;
    const ort = d.reduce((a, b) => a + b, 0) / n;
    const std = n > 1 ? Math.sqrt(d.reduce((a, b) => a + (b - ort) * (b - ort), 0) / (n - 1)) : 0;
    const se = std / Math.sqrt(n);
    return { ort: ort, std: std, se: se, t: se ? ort / se : 0, taban: 2.8 * se, n: n };
}

let eskiTaban = null;
try { eskiTaban = JSON.parse(fs.readFileSync(TABAN_YOL, 'utf8')); } catch (e) { /* ilk kosu */ }

console.log('');
console.log('SOMURU KAPISI   havuz: ' + HAVUZ.join(', ') + '   ' + MAC + ' tohum x 2 rol x 2 kol');
console.log('  olcut: sagkalim(bot KAPALI) - sagkalim(bot ACIK) = SOMURU GUCU (puan)');
console.log('  taban: ' + (eskiTaban ? (TABAN_YOL + '  (' + eskiTaban.tarih + ')') : 'YOK (ilk kosu)'));
console.log('');

const sonuc = {};
let kapiKirmizi = false;

for (const somuru of HAVUZ) {
    const guc = [], bindTop = [], marjFark = [];
    let kapaliBind = 0;
    for (let i = 0; i < MAC; i++) {
        for (const aiSaldiran of [true, false]) {
            const k = kos(TOHUM0 + i, somuru, false, aiSaldiran);
            const a = kos(TOHUM0 + i, somuru, true, aiSaldiran);
            guc.push((k.sagkalim - a.sagkalim) * 100);
            marjFark.push(a.marj - k.marj);
            bindTop.push(a.bind);
            kapaliBind += k.bind;
        }
    }
    const g = istat(guc);
    const bind = bindTop.reduce((x, y) => x + y, 0);
    const bindMac = bindTop.filter((x) => x > 0).length;
    sonuc[somuru] = { guc: +g.ort.toFixed(2), std: +g.std.toFixed(2), n: g.n, bind: bind };

    console.log('  ── ' + somuru + ' ──');
    console.log('     baglanma: ' + bind + '  (bind>0 mac ' + bindMac + '/' + bindTop.length +
        ')   kapali kolda ' + kapaliBind + ' (0 olmali)');
    console.log('     SOMURU GUCU: ' + (g.ort >= 0 ? '+' : '') + g.ort.toFixed(2) + ' puan sagkalim' +
        '   std ' + g.std.toFixed(2) + '   t ' + g.t.toFixed(2) + '   saptama tabani ' + g.taban.toFixed(2));
    /* MARJI DA TAM ISTATISTIKLE YAZ — ilk kosuda sagkalim tabanin ALTINDA kalirken
       marj etkisi devasa cikti (yerel_ustunluk: sagkalim +10.84 / taban 17.08 ama marj
       -3659). Yani hangi metrigin daha keskin oldugu SOMURUCUYE GORE degisiyor; ikisini
       birden yazmak, sonradan "hangisine bakalim" diye secim yapmayi (post-hoc) onler. */
    const m = istat(marjFark);
    console.log('     AI marji: ' + (m.ort >= 0 ? '+' : '') + Math.round(m.ort) + ' TL' +
        '   std ' + Math.round(m.std) + '   t ' + m.t.toFixed(2) +
        '   saptama tabani ' + Math.round(m.taban) +
        '   ' + (Math.abs(m.ort) >= m.taban ? '** TABANIN USTUNDE **' : 'taban alti'));
    sonuc[somuru].marj = Math.round(m.ort);
    sonuc[somuru].marjStd = Math.round(m.std);

    if (!bind) {
        console.log('     ⛔ BOT HIC BAGLAMADI — olcum anlamsiz, kapi KIRMIZI.');
        kapiKirmizi = true;
    } else if (kapaliBind) {
        console.log('     ⛔ KAPALI KOLDA BAGLADI — bayrak kapiyi tutmuyor, kapi KIRMIZI.');
        kapiKirmizi = true;
    } else if (eskiTaban && eskiTaban.somuru && eskiTaban.somuru[somuru]) {
        const t0 = eskiTaban.somuru[somuru].guc;
        const artis = g.ort - t0;
        console.log('     taban ' + t0.toFixed(2) + ' -> simdi ' + g.ort.toFixed(2) +
            '   degisim ' + (artis >= 0 ? '+' : '') + artis.toFixed(2) +
            '   (esik ' + g.taban.toFixed(2) + ')');
        if (artis > g.taban) {
            console.log('     ⛔ GERILEME — somuru GUCLENDI, AI bu taktige karsi kotulesti. SURUM GECMEZ.');
            kapiKirmizi = true;
        } else {
            console.log('     ✅ gerileme yok');
        }
    } else {
        console.log('     ℹ  bu somurucu icin taban YOK — bu kosu taban olabilir (--taban-yaz)');
    }
    console.log('');
}

console.log('  ' + '='.repeat(72));
console.log('  KAPI: ' + (kapiKirmizi ? '⛔ KIRMIZI' : '✅ YESIL'));
console.log('  ' + '='.repeat(72));
console.log('');
console.log('  OKUMA: "somuru gucu" pozitifse bot AI\'nin sagkalimini DUSURUYOR demektir —');
console.log('  yani o taktik ISLIYOR. Kapinin isi gucun TABANDAN ARTMASINI yakalamak;');
console.log('  mevcut gucun buyuk olmasi kapiyi kirmizi yapmaz, onu DUZELTME ISI yapar.');
console.log('  ⚠ Bot AI\'yi yenemiyorsa bu da bilgidir: o insan imzasi tek basina somuru degil.');

if (TABAN_YAZ) {
    const yeni = { tarih: new Date().toISOString().slice(0, 10), mac: MAC, tohum0: TOHUM0, somuru: sonuc };
    fs.mkdirSync(path.dirname(TABAN_YOL), { recursive: true });
    fs.writeFileSync(TABAN_YOL, JSON.stringify(yeni, null, 1));
    console.log('');
    console.log('  TABAN YAZILDI: ' + TABAN_YOL);
}
if (hatalar && hatalar.length) console.log('  tezgah uyarilari: ' + hatalar.length);
