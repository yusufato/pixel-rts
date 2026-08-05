// KUVVET DAGILIMI TESHISI (operasyon katmani)
// Zirhli teshisi buraya isaret etti: birim ilerledigi icin degil, DUSMAN ustune geldigi icin
// oluyor ve olurken 1:3 yerel dezavantajda. Soru artik birim degil KUTLE:
//   (1) Iki taraf kuvvetini ne kadar YOGUNLASTIRIYOR? (yogunlasma endeksi, 0=esit yayilmis)
//   (2) Bizim kutlemiz DUSMANIN kutlesiyle ayni yerde mi? (merkez mesafesi)
//   (3) Dusmanin ANA CABA sektorunde bizim/onun deger orani nedir? (yerel oran)
//   (4) Bu zamanla nasil degisiyor? (erken/orta/gec)
// Deger = birim maliyeti (TL). Sektor = 3 sutun x 2 satir (6 sektor).
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const { ctx } = tezgahKur();
const _si = process.argv.indexOf('--seed');
const SEED = _si >= 0 ? Number(process.argv[_si + 1]) : 2024;
// TARAF-BASI izolasyon: yalniz SAVUNANIN (mavi) sektor-komutasi degisir, saldiran sabit kalir.
const NOSEKTOR = process.argv.includes('--nosektor');       // her iki taraf kapali (eski, kirli A/B)
const SAVKAPALI = process.argv.includes('--savkapali');     // YALNIZ savunan kapali (temiz izolasyon)

const kod = '(() => {' +
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true; BATTLE_BALANCE.on = true;' +
    'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = ' + (!NOSEKTOR) + ';' +
    'if (typeof BATTLE_SECTOR_COMMAND_BLUE !== "undefined") BATTLE_SECTOR_COMMAND_BLUE = ' + (SAVKAPALI ? 'false' : 'null') + ';' +
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + SEED + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"kd", ally:true });' +
    'startBattle();' +
    // SEKTOR = X-BANDI (SY=1). Taarruz ekseni Y oldugu icin savunanin eslestirmesi gereken sey
    // dusmanin HANGI SUTUNDAN geldigidir. 3x2 bolme erken oyunda "dusman kendi yarisinda" ile
    // "biz eslesemedik"i karistiriyordu (ana-sektor orani sahte 0 cikiyordu).
    'const SX = 3, SY = 1;' +
    'const ornekler = [];' +
    'const ph = SIM.headless; SIM.headless = true; let st = 0;' +
    'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {' +
    '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
    '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
    '  if (SIM.tick % 200 !== 0) continue;' +            // 10sn ornekleme
    '  const kSek = new Array(SX*SY).fill(0), mSek = new Array(SX*SY).fill(0);' +
    '  let kx=0,ky=0,kw=0,mx=0,my=0,mw=0;' +
    '  for (const u of SIM.units) { if (u.dead || u.loaded || u.abandoned) continue;' +
    '    const s = STATS[u.type]; const v = (s && s.cost) || 0; if (!v) continue;' +
    '    const ix = Math.min(SX-1, Math.floor(u.x / WORLD_W * SX));' +
    '    const iy = Math.min(SY-1, Math.floor(u.y / WORLD_H * SY));' +
    '    const idx = iy*SX + ix;' +
    '    if (u.isRed) { kSek[idx] += v; kx += u.x*v; ky += u.y*v; kw += v; }' +
    '    else { mSek[idx] += v; mx += u.x*v; my += u.y*v; mw += v; } }' +
    '  if (!kw || !mw) continue;' +
    '  const hhi = a => { const t = a.reduce((x,y)=>x+y,0); return t ? a.reduce((x,y)=>x+(y/t)*(y/t),0) : 0; };' +
    '  let anaIdx = 0; for (let i=1;i<kSek.length;i++) if (kSek[i] > kSek[anaIdx]) anaIdx = i;' +   // KIRMIZI (saldiran) ana cabasi
    '  ornekler.push({ sn: Math.round(SIM.tick*BATTLE_TICK_SEC),' +
    '    kHHI: hhi(kSek), mHHI: hhi(mSek),' +
    '    merkezMesafe: Math.hypot(kx/kw - mx/mw, ky/kw - my/mw),' +
    '    anaSektorOran: kSek[anaIdx] > 0 ? mSek[anaIdx] / kSek[anaIdx] : null,' +
    '    kToplam: kw, mToplam: mw });' +
    '} } finally { SIM.headless = ph; }' +
    'return JSON.stringify({ ornekler, sektorKomuta: (typeof BATTLE_SECTOR_COMMAND !== "undefined") ? BATTLE_SECTOR_COMMAND : null });' +
    '})()';

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'kd.js' }));
const o = r.ornekler;
console.log('KUVVET DAGILIMI — seed' + SEED + '   [sektor: ' + (NOSEKTOR ? 'ikisi de KAPALI' : (SAVKAPALI ? 'savunan KAPALI, saldiran acik' : 'ikisi de acik')) + ']   ' + o.length + ' ornek');
console.log('  SEKTOR = X-BANDI (3 sutun). HHI: 0.333 = esit yayilmis, 1.0 = tek sutunda');
console.log('');
console.log('  ' + 'sn'.padStart(5) + 'K-HHI'.padStart(8) + 'M-HHI'.padStart(8) + '  merkezMes'.padStart(11) + '  anaSekOran'.padStart(12) + '  K-TL'.padStart(7) + '  M-TL'.padStart(7));
const kes = [0, Math.floor(o.length/3), Math.floor(o.length*2/3), o.length-1];
for (const i of kes) { const x = o[i]; if (!x) continue;
    console.log('  ' + String(x.sn).padStart(5) + String(Math.round(x.kHHI*1000)/1000).padStart(8) +
        String(Math.round(x.mHHI*1000)/1000).padStart(8) + (Math.round(x.merkezMesafe) + 'px').padStart(11) +
        (x.anaSektorOran != null ? (Math.round(x.anaSektorOran*100)/100) : '-').toString().padStart(12) +
        String(Math.round(x.kToplam)).padStart(7) + String(Math.round(x.mToplam)).padStart(7));
}
const ort = f => o.length ? o.reduce((s,x)=>s+(f(x)||0),0) / o.filter(x=>f(x)!=null).length : 0;
console.log('');
console.log('  ORTALAMA: K-HHI ' + Math.round(ort(x=>x.kHHI)*1000)/1000 + '   M-HHI ' + Math.round(ort(x=>x.mHHI)*1000)/1000 +
    '   merkez mesafe ' + Math.round(ort(x=>x.merkezMesafe)) + 'px' +
    '   ana-sektor oran ' + Math.round(ort(x=>x.anaSektorOran)*100)/100);
console.log('  -> ana-sektor oran < 1 ise SALDIRANIN ANA CABASINDA SAVUNAN AZINLIKTA (kok sorun)');
