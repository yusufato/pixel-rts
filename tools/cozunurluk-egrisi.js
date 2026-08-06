// COZUNURLUK EGRISI: 5sn / 10sn / 15sn ornekleme ne kadar bilgi tasiyor?
// Kullanici: "en buyuk 5 saniye, en kucuk 15 saniye, suan 10 saniye; ucunu de DETERMINISTIK bir
// macta olc ve ucunun cikardigi sonuclarin ne kadar cozunurlukte oldugu bak."
//
// IKI SORU, IKI OLCUM:
//   (A) DETERMINIZM: ayni tohum, farkli ornekleme araligi -> ORTAK tiklerdeki degerler BIREBIR
//       ayni mi? (Ornekleme salt-okur olmali; degilse tum veri kirlenir.)
//   (B) BILGI KAYBI: 5sn serisi GERCEK kabul edilir; 10sn ve 15sn serilerinden ARA DEGERLE
//       yeniden kurulur ve hata olculur. Hata kucukse ince ornekleme bos yere yer kapliyor demektir.
//
// NOT: 10sn ve 15sn serileri 5sn serisinin ALT KUMESI degildir (100/200/300 tik: 300, 100'un kati
// ama 200'un degil). Bu yuzden ortak tik kumesi ayrica hesaplanir.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const SEED = Number(arg('--seed', 4001));
// isinma: sonuclari atilan bir on kosu (sure olcumunu adil yapar)
const ISINMA = process.argv.includes('--isinma');
const GX = Number(arg('--gx', 16)), GY = Number(arg('--gy', 10)), KANAL = 8;
// SIRA parametrik: ilk kosu JIT isinmasi tasiyor -> sureyi olcerken sirayi TERS cevirip dogrula.
const ARALIKLAR = (arg('--sira', '100,200,300')).split(',').map(Number);

const havuz = JSON.parse(fs.readFileSync('qa-runtime/adaylar-panel.json', 'utf8'));
const sal = havuz.filter(a => !a.heuristik && a.aile !== 'rakip')[0];

const { ctx } = tezgahKur();

function kos(aralik) {
    const kod = [
        '(() => {',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        'BATTLE_RECIPE_RED = ' + JSON.stringify(sal) + ';',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + SEED + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false, pro:true }), false, { source:"ce", ally:true });',
        'startBattle();',
        'const GX = ' + GX + ', GY = ' + GY + ', KANAL = ' + KANAL + ';',
        'const ornekler = [];',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '  if (SIM.tick % ' + aralik + ') continue;',
        '  const R = new Float64Array(KANAL * GY * GX);',
        '  for (const u of SIM.units) {',
        '    if (u.dead || u.loaded || u.abandoned) continue;',
        '    const s = STATS[u.type]; if (!s) continue;',
        '    const v = s.cost || 0;',
        '    const gx = Math.min(GX-1, Math.max(0, Math.floor(u.x / WORLD_W * GX)));',
        '    const gy = Math.min(GY-1, Math.max(0, Math.floor(u.y / WORLD_H * GY)));',
        '    const h = gy * GX + gx, t = u.isRed ? 0 : 1;',
        '    const dolayli = !!(s.weapons && s.weapons[0] && s.weapons[0].indirect);',
        '    R[(0+t)*GY*GX + h] += v;',
        '    R[(2+t)*GY*GX + h] += Math.max(0, u.hp);',
        '    if (dolayli) R[(4+t)*GY*GX + h] += v;',
        '    if (u.isAir) R[(6+t)*GY*GX + h] += v;',
        '  }',
        '  ornekler.push({ tik: SIM.tick, r: Array.from(R) });',
        '} } finally { SIM.headless = ph; }',
        'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);',
        'BATTLE_RECIPE_RED = null;',
        'return JSON.stringify({ bitisTik: SIM.tick, marj: Math.round(oS.effectiveValue - oD.effectiveValue), ornekler });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'ce-' + aralik + '.js' }));
}

console.log('COZUNURLUK EGRISI — seed ' + SEED + ', raster ' + GX + 'x' + GY + 'x' + KANAL);
console.log('');
const sonuc = {};
if (ISINMA) { kos(600); console.log('  (isinma kosusu yapildi, sonucu atildi)'); }
for (const a of ARALIKLAR) {
    const t0 = Date.now();
    sonuc[a] = kos(a);
    sonuc[a].sure = Date.now() - t0;
    const bayt = JSON.stringify(sonuc[a].ornekler).length;
    console.log('  ' + (a * 0.05) + 'sn araligi: ' + String(sonuc[a].ornekler.length).padStart(3) + ' goruntu   ' +
        (bayt / 1024).toFixed(0).padStart(5) + ' KB   ' + (sonuc[a].sure / 1000).toFixed(1) + 'sn   ' +
        'mac ' + sonuc[a].bitisTik + ' tik, marj ' + sonuc[a].marj);
}

// ── (A) DETERMINIZM: ortak tiklerde degerler BIREBIR ayni mi ──
console.log('');
console.log('  (A) DETERMINIZM — ortak tiklerde raster BIREBIR ayni mi:');
const harita = {};
for (const a of ARALIKLAR) { harita[a] = new Map(sonuc[a].ornekler.map(o => [o.tik, o.r])); }
let denetim = 0, fark = 0, maxFark = 0;
for (const t of harita[100].keys()) {
    for (const a of [200, 300]) {
        if (!harita[a].has(t)) continue;
        denetim++;
        const x = harita[100].get(t), y = harita[a].get(t);
        for (let i = 0; i < x.length; i++) {
            const d = Math.abs(x[i] - y[i]);
            if (d > 1e-9) { fark++; if (d > maxFark) maxFark = d; break; }
        }
    }
}
console.log('     karsilastirilan ortak tik: ' + denetim + '   FARKLI: ' + fark +
    (fark ? '   (en buyuk sapma ' + maxFark.toFixed(3) + ')' : '   -> ornekleme simulasyonu BOZMUYOR'));

// ── (B) BILGI KAYBI: 5sn GERCEK; 10/15sn'den ara degerle yeniden kur ──
function araDeger(seri, tik) {
    // seri: [{tik, r}] artan; lineer ara deger
    let a = null, b = null;
    for (const o of seri) { if (o.tik <= tik) a = o; if (o.tik >= tik) { b = o; break; } }
    if (!a) return b ? b.r : null;
    if (!b) return a.r;
    if (a.tik === b.tik) return a.r;
    const w = (tik - a.tik) / (b.tik - a.tik);
    return a.r.map((v, i) => v + (b.r[i] - v) * w);
}
console.log('');
console.log('  (B) BILGI KAYBI — 5sn serisi GERCEK, digerleri ara degerle yeniden kuruldu:');
console.log('     ' + 'seri'.padEnd(9) + 'ort. bagil hata'.padStart(17) + '  en kotu an'.padStart(13) + '  aciklanan varyans'.padStart(19));
const gercek = sonuc[100].ornekler;
const gTop = gercek.map(o => o.r.reduce((s, v) => s + v, 0));
const gOrt = gTop.reduce((s, v) => s + v, 0) / gTop.length;
for (const a of [200, 300]) {
    let hataTop = 0, n = 0, enKotu = 0, enKotuTik = 0, ssRes = 0, ssTot = 0;
    for (const o of gercek) {
        const tah = araDeger(sonuc[a].ornekler, o.tik);
        if (!tah) continue;
        let l1 = 0, norm = 0;
        for (let i = 0; i < o.r.length; i++) { l1 += Math.abs(o.r[i] - tah[i]); norm += Math.abs(o.r[i]); }
        const bagil = norm ? l1 / norm : 0;
        hataTop += bagil; n++;
        if (bagil > enKotu) { enKotu = bagil; enKotuTik = o.tik; }
        const gt = o.r.reduce((s, v) => s + v, 0), pt = tah.reduce((s, v) => s + v, 0);
        ssRes += (gt - pt) ** 2; ssTot += (gt - gOrt) ** 2;
    }
    const r2 = ssTot ? 1 - ssRes / ssTot : 0;
    console.log('     ' + ((a * 0.05) + 'sn').padEnd(9) +
        ('%' + (hataTop / n * 100).toFixed(1)).padStart(17) +
        ('%' + (enKotu * 100).toFixed(1) + ' @' + Math.round(enKotuTik * 0.05) + 'sn').padStart(13) +
        (r2.toFixed(4)).padStart(19));
}
console.log('');
console.log('  OKUMA: bagil hata kucukse (<%5) ince ornekleme BOS YERE yer kapliyor demektir.');
console.log('         "en kotu an" savas durumunun en hizli degistigi ani gosterir.');
