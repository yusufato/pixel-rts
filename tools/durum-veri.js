// DURUM VERISI: macin ICINDEN anlik goruntuler + nihai sonuc
// Kullanici: "vekil modeli buyutelim, tum maci tarasin, GPU tum birimleri gozlerinden gorebilir."
//
// Kompozisyon modeli maci KOSMADAN tahmin ediyordu (rho 0.529). Bu onun bir ust seviyesi:
// macin HERHANGI BIR ANINDAKI durumdan nihai marji tahmin etmek. Iki ayri isi acar:
//   (1) beonai'nin MIYOP oracle'i yerine gercek bir DEGER FONKSIYONU (docs/PLAN-BEONAI-V2-ODUL.md)
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
const cikti = fs.createWriteStream(OUT, { flags: 'w' });
let yazilan = 0, macNo = 0;

const kodSablon = (tarif, seed) => [
    '(() => {',
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
    'BATTLE_RECIPE_RED = ' + JSON.stringify(tarif) + ';',
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, recipe: ' + JSON.stringify(rakip.heuristik ? null : rakip) + ' || undefined, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false, pro:true }), false, { source:"dv", ally:true });',
    'startBattle();',
    'const GX = ' + GX + ', GY = ' + GY + ', KANAL = 8;',
    'const ornekler = [];',
    'const KAT = ["air","air_defense","armor","indirect","infantry","logistics","recon","support","uav","command"];',
    'const ph = SIM.headless; SIM.headless = true; let st = 0;',
    'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
    '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
    '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
    '  if (SIM.tick % ' + ARALIK + ') continue;',
    // ── RASTER: KANAL x GY x GX, simetrik kanal ciftleri (kendi/dusman)
    '  const R = new Float64Array(KANAL * GY * GX);',
    '  let kDeger = 0, mDeger = 0, kHp = 0, mHp = 0, kSay = 0, mSay = 0;',
    '  let kAmmo = 0, kAmmoMax = 0, mAmmo = 0, mAmmoMax = 0, kPanik = 0, mPanik = 0;',
    '  const kKat = {}, mKat = {};',
    '  let kx = 0, ky = 0, mx = 0, my = 0;',
    '  for (const u of SIM.units) {',
    '    if (u.dead || u.loaded || u.abandoned) continue;',
    '    const s = STATS[u.type]; if (!s) continue;',
    '    const v = s.cost || 0;',
    '    const gx = Math.min(GX-1, Math.max(0, Math.floor(u.x / WORLD_W * GX)));',
    '    const gy = Math.min(GY-1, Math.max(0, Math.floor(u.y / WORLD_H * GY)));',
    '    const hucre = gy * GX + gx;',
    '    const dolayli = !!(s.weapons && s.weapons[0] && s.weapons[0].indirect);',
    '    const taban = u.isRed ? 0 : 1;',
    '    R[(0 + taban) * GY * GX + hucre] += v;',                         // deger yogunlugu
    '    R[(2 + taban) * GY * GX + hucre] += Math.max(0, u.hp);',         // HP yogunlugu
    '    if (dolayli) R[(4 + taban) * GY * GX + hucre] += v;',            // dolayli ates
    '    if (u.isAir) R[(6 + taban) * GY * GX + hucre] += v;',            // hava
    '    const kat = s.category || "?";',
    '    if (u.isRed) { kDeger += v; kHp += Math.max(0,u.hp); kSay++; kx += u.x*v; ky += u.y*v;',
    '      kAmmo += (u.ammo||0); kAmmoMax += (u.maxAmmo||0); kPanik += (u.panic||0); kKat[kat] = (kKat[kat]||0) + v; }',
    '    else { mDeger += v; mHp += Math.max(0,u.hp); mSay++; mx += u.x*v; my += u.y*v;',
    '      mAmmo += (u.ammo||0); mAmmoMax += (u.maxAmmo||0); mPanik += (u.panic||0); mKat[kat] = (mKat[kat]||0) + v; }',
    '  }',
    '  if (!kDeger || !mDeger) continue;',
    '  kx /= kDeger; ky /= kDeger; mx /= mDeger; my /= mDeger;',
    // TEMAS: birbirinin menzilindeki dusman cifti sayisi (uzamsal izgara ile ucuz)
    '  let temas = 0;',
    '  for (const u of SIM.units) { if (u.dead || u.loaded || !u.isRed) continue;',
    '    for (const e of SIM.spatialGrid.getNearby(u.x, u.y, u.range)) {',
    '      if (e.dead || e.loaded || e.isRed) continue;',
    '      if (Math.hypot(e.x-u.x, e.y-u.y) <= u.range) { temas++; break; } } }',
    '  const skaler = [',
    '    SIM.tick / 7300, kDeger/6500, mDeger/6500, kDeger/(mDeger||1),',
    '    kHp/(kDeger*3||1), mHp/(mDeger*3||1), kSay/48, mSay/48,',
    '    Math.hypot(kx-mx, ky-my)/WORLD_W, (kx/WORLD_W), (ky/WORLD_H), (mx/WORLD_W), (my/WORLD_H),',
    '    kAmmoMax ? kAmmo/kAmmoMax : 0, mAmmoMax ? mAmmo/mAmmoMax : 0,',
    '    kSay ? kPanik/kSay/100 : 0, mSay ? mPanik/mSay/100 : 0, temas/48',
    '  ];',
    '  for (const k of KAT) skaler.push((kKat[k]||0)/(kDeger||1));',
    '  for (const k of KAT) skaler.push((mKat[k]||0)/(mDeger||1));',
    '  ornekler.push({ tik: SIM.tick, r: Array.from(R), s: skaler });',
    '} } finally { SIM.headless = ph; }',
    // NIHAI SONUC: her anlik goruntunun HEDEFI
    'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);',
    'const b = SIM.battle || {}; BATTLE_RECIPE_RED = null;',
    'const nihaiMarj = Math.round(oS.effectiveValue - oD.effectiveValue);',
    'return JSON.stringify({ nihaiMarj, kazanan: b.winnerSide===true?1:(b.winnerSide===false?0:(nihaiMarj>0?1:0)),',
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
    const seed = TOHUMLAR[i % TOHUMLAR.length];
    let r;
    try { r = JSON.parse(vm.runInContext(kodSablon(tarif, seed), ctx, { filename: 'dv-' + i + '.js' })); }
    catch (e) { console.log('  ! mac ' + i + ' hata: ' + e.message); continue; }
    macNo++;
    for (const o of r.ornekler) {
        cikti.write(JSON.stringify({ ad: tarif.ad, seed, tik: o.tik, bitisTik: r.bitisTik,
            r: o.r, s: o.s, y: r.nihaiMarj, kazandi: r.kazanan }) + '\n');
        yazilan++;
    }
    if ((i + 1) % 10 === 0) {
        const gecen = (Date.now() - t0) / 1000;
        console.log('  ' + (i + 1) + '/' + SAYI + ' mac   ' + yazilan + ' goruntu   ' +
            (gecen).toFixed(0) + 'sn   (' + ((i + 1) / gecen).toFixed(2) + ' mac/sn)');
    }
}
cikti.end();
console.log('');
console.log('  TOPLAM: ' + macNo + ' mac, ' + yazilan + ' anlik goruntu -> ' + OUT);
console.log('  (her goruntunun HEDEFI o macin NIHAI marji; model "su andan sonuca" ogrenir)');
