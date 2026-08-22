// DURUM VERISI: macin ICINDEN anlik goruntuler + nihai sonuc
// Kullanici: "vekil modeli buyutelim, tum maci tarasin, GPU tum birimleri gozlerinden gorebilir."
//
// Kompozisyon modeli maci KOSMADAN tahmin ediyordu (rho 0.529). Bu onun bir ust seviyesi:
// macin HERHANGI BIR ANINDAKI durumdan nihai marji tahmin etmek. Iki ayri isi acar:
//   (1) beonai'nin MIYOP oracle'i yerine gercek bir DEGER FONKSIYONU (../docs/battle-ai/plans/PLAN-BEONAI-V2-ODUL.md)
//   (2) kalibre edilmis ERKEN DURDURMA (sabit esik yerine "model %95 emin" kuralı)
//   (3) teshis: hangi durum ozellikleri kazanmayi belirliyor
//
// GOSTERIM - iki parcali:
//   RASTER: sahayi IZGARAYA rasterize eder, cok kanalli bir "goruntu" gibi -> CNN'e uygun,
//           GPU'nun gercekten parladigi bicim. Kanallar simetrik (kendi/dusman ciftleri).
//   SKALER: oran, temas, muhimmat, panik, kategori paylari - CNN'in goremeyecegi ozetler.
//
// DETERMINIZM: yalnizca OKUR, sim durumuna dokunmaz. Ornekleme tik-bazli (RNG yok).
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const ADAYLAR = arg('--adaylar', 'qa-runtime/adaylar-panel.json');
const OUT = arg('--out', 'qa-runtime/durum-veri.jsonl');
const SAYI = Math.max(1, Number(arg('--mac', 40)) || 40);          // kac mac
const ARALIK = Math.max(20, Number(arg('--aralik', 100)) || 100);  // kac tikte bir anlik goruntu (100 = 5sn)
// VARSAYILAN 5sn: cozunurluk egrisi olculdu (tools/cozunurluk-egrisi.js) - 5/10/15sn ayni sureyi
// aliyor (6.1/6.1/6.4sn, fark JIT isinmasiydi) ama 10sn uzamsal detayin %31'ini, 15sn %45'ini
// kaybediyor. Ince ornekleme BEDAVA oldugu icin en incesi secildi.
// GECE KOSUSU: birden fazla isci ayni anda kosarken tohum havuzlari CAKISMAMALI.
const TOHUM_OFS = Math.max(0, Number(arg('--tohumofs', 0)) || 0);
// ERKEN BITIS ESIGI: bir tarafin kalan deger payi bu orani asinca mac kesilir (kullanici karari).
const ESIK = Math.min(0.999, Math.max(0.5, Number(arg('--esik', 0.95)) || 0.95));
const GX = Math.max(4, Number(arg('--gx', 16)) || 16);             // izgara sutun
const GY = Math.max(4, Number(arg('--gy', 10)) || 10);             // izgara satir

const havuz = JSON.parse(fs.readFileSync(ADAYLAR, 'utf8'));
const saldiranlar = havuz.filter(a => !a.heuristik && a.aile !== 'rakip');
const rakip = havuz.find(a => a.heuristik) || havuz.find(a => a.aile === 'rakip');
if (!rakip) { console.error('rakip bulunamadi'); process.exit(1); }

// TOHUM HAVUZU: tarama havuzuyla CAKISMAMALI - bu veri model egitimi icin, turnuva olcumu icin degil.
const TOHUMLAR = [4001, 4003, 4007, 4013, 4019, 4021, 4027, 4049, 4051, 4057, 4073, 4079,
                  4091, 4093, 4099, 4111, 4127, 4129, 4133, 4139];

const { ctx } = tezgahKur();
// SENKRON YAZMA (KOK NEDEN): createWriteStream BELLEGE biriktirir, diske yazmayi olay dongusune
// birakir. Toplama dongusu tamamen SENKRON (vm.runInContext bloklar) -> olay dongusu HIC calismaz
// -> tek satir bile diske dusmez, bellek sisip surec cokene kadar buyur. Gecmisteki gece kosusunun
// 0.17 mac/sn'ye dusmesinin sebebi de buydu. fs.writeSync mac basina bir kez: disk+bellek sabit.
const CIKTI_FD = fs.openSync(OUT, 'w');
let yazilan = 0, macNo = 0;

const kodSablon = (tarif, seed) => [
    '(() => {',
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
    'BATTLE_RECIPE_RED = ' + JSON.stringify(tarif) + ';',
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, recipe: ' + JSON.stringify(rakip.heuristik ? null : rakip) + ' || undefined, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false, pro:true }), false, { source:"dv", ally:true });',
    'startBattle();',
    // BEONAI ODUL BAGI: kredi defteri acik toplanir. Miyop oracle'in yerine gececek sinyal budur —
    // "kim kazandirdi" sorusu tek sayiyla degil, birim-basi KANAL'larla cevaplanir.
    'BATTLE_CREDIT.on = true; battleKrediSifirla();',
    'for (const u of SIM.units) battleKrediKayit(u);',
    'const KANALLAR = ["hasar","panik","baski","imhaDeger","emilen","gorusTekil","tespit","jamTik",',
    '  "iyilestirme","kurtarma","muhimmat","kuruEngel","siperTik","yakitDolum","mayin","tasinan",',
    '  "droneHasar","haleTik","rally","havaCaydirma","havaHasar"];',
    'const krediOzet = () => { const k = { r:{}, m:{} };',
    '  for (const c of KANALLAR) { k.r[c] = 0; k.m[c] = 0; }',
    '  for (const id in BATTLE_CREDIT.birim) { const b = BATTLE_CREDIT.birim[id]; const t = b.isRed ? k.r : k.m;',
    '    for (const c of KANALLAR) t[c] += (b[c] || 0); }',
    '  return k; };',
    'const GX = ' + GX + ', GY = ' + GY + ', KANAL = 8;',
    'const ornekler = [];',
    'const KAT = ["air","air_defense","armor","indirect","infantry","logistics","recon","support","uav","command"];',
    'let erken = false;',
    'const ph = SIM.headless; SIM.headless = true; let st = 0;',
    'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
    '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
    '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
    '  if (SIM.tick % ' + ARALIK + ') continue;',
    // ── RASTER: KANAL x GY x GX, simetrik kanal ciftleri (kendi/dusman)
    // PAYLASILAN OZNITELIK (js/BattleStateFeatures.js): bu blok eskiden satir-ici idi ve ayni
    // hesap BattleOracle tarafinda da gerekiyor. Iki kopya en ufak sapsa deger agi ANLAMSIZ
    // tahmin uretir (sessiz bozulma) -> tek kaynak. Esitligi byte-karsilastirmasi ile kanitlandi.
    '  const _oz = battleDurumOzellik(GX, GY);',
    '  if (!_oz) continue;',
    '  const kDeger = _oz.s[1] * 6500, mDeger = _oz.s[2] * 6500;',
    '  if (Math.max(kDeger, mDeger) / (kDeger + mDeger) >= ' + ESIK + ') { erken = true; break; }',
    '  ornekler.push({ tik: SIM.tick, r: _oz.r, s: _oz.s });',
    '} } finally { SIM.headless = ph; }',
    // NIHAI SONUC: her anlik goruntunun HEDEFI
    'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);',
    'const b = SIM.battle || {}; BATTLE_RECIPE_RED = null;',
    'const nihaiMarj = Math.round(oS.effectiveValue - oD.effectiveValue);',
    'const _kSon = krediOzet(); BATTLE_CREDIT.on = false;',
    'return JSON.stringify({ nihaiMarj, kredi: _kSon, erkenDur: erken, kazanan: b.winnerSide===true?1:(b.winnerSide===false?0:(nihaiMarj>0?1:0)),',
    '  bitisTik: SIM.tick, ornekler });',
    '})()'
].join('');

console.log('DURUM VERISI TOPLAMA');
console.log('  aday havuzu : ' + saldiranlar.length + '   rakip: ' + rakip.ad);
console.log('  mac         : ' + SAYI + '   ornekleme: her ' + ARALIK + ' tik (' + (ARALIK * 0.05) + 'sn)');
console.log('  raster      : ' + GX + 'x' + GY + ' x 8 kanal = ' + (GX * GY * 8) + ' sayi/goruntu');
console.log('');

const t0 = Date.now();
for (let i = 0; i < SAYI; i++) {
    const tarif = saldiranlar[i % saldiranlar.length];
    const seed = TOHUMLAR[(i + TOHUM_OFS) % TOHUMLAR.length] + Math.floor((i + TOHUM_OFS) / TOHUMLAR.length) * 1000;
    let r;
    try { r = JSON.parse(vm.runInContext(kodSablon(tarif, seed), ctx, { filename: 'dv-' + i + '.js' })); }
    catch (e) { console.log('  ! mac ' + i + ' hata: ' + e.message); continue; }
    macNo++;
    let _blok = '';
    for (const o of r.ornekler) {
        _blok += JSON.stringify({ ad: tarif.ad, seed, tik: o.tik, bitisTik: r.bitisTik,
            r: o.r, s: o.s, y: r.nihaiMarj, kazandi: r.kazanan, kredi: r.kredi,
            erkenDur: !!r.erkenDur }) + '\n';
        yazilan++;
    }
    if (_blok) fs.writeSync(CIKTI_FD, _blok);   // mac basina TEK senkron yazma (bkz. CIKTI_FD notu)
    if ((i + 1) % 10 === 0) {
        const gecen = (Date.now() - t0) / 1000;
        console.log('  ' + (i + 1) + '/' + SAYI + ' mac   ' + yazilan + ' goruntu   ' +
            (gecen).toFixed(0) + 'sn   (' + ((i + 1) / gecen).toFixed(2) + ' mac/sn)');
    }
}
fs.closeSync(CIKTI_FD);
console.log('');
console.log('  TOPLAM: ' + macNo + ' mac, ' + yazilan + ' anlik goruntu -> ' + OUT);
console.log('  (her goruntunun HEDEFI o macin NIHAI marji; model "su andan sonuca" ogrenir)');
