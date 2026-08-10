// TITREME — TIK COZUNURLUGU (50ms), HER BIRIMIN KENDI GOZUNDEN.
//
// Kullanici: "titremeyi ben goruyorum ve az degil". Sim 20 Hz'de (50ms) adim atar; ARALARDA birim
// durumu YOKTUR — yani 0.1ms'lik veri uretilemez. Uretilebilecek EN INCE cozunurluk tik'tir ve
// canli oyun da AYNI sabit 50ms adimla kosar (js/main.js gameLoop akumulatoru) → tezgah sadiktir.
//
// GORULEN titreme uc ayri seyden gelebilir; ucu de AYRI olculur:
//   A. KONUM SALINIMI  — ardisik tiklerde yon >120 derece donuyor (ileri-geri)
//   B. ADIM DUZENSIZLIGI — tik basina alinan yol cok degisken (0,14,2,16 px...). Ekranda
//      "duruyor-firliyor" olarak gorunur; ortalama hiz normal olsa bile TITREME hissi verir.
//      Olcut: degisim katsayisi (std/ort) ve "dur-firla" gecis sayisi.
//   C. ACI TITREMESI   — konum duzgun ama birim NAMLUSUNU/govdesini saga sola ceviriyor.
//      Sprite dondugu icin gozle titreme olarak gorunur. Olcut: saniyedeki >45 derece aci donusu.
//
// Cikti ayrica ham tik izini yazar (birim basina x,y,aci) — kok-neden icin tik tik okunabilir.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const SEED = Number(arg('--seed', 202));
const SANIYE = Number(arg('--saniye', 100));
const OUT = arg('--out', 'qa-runtime/titreme-tik.json');
const IZYAZ = process.argv.includes('--izyaz');

const { ctx } = tezgahKur();

// --set "BAYRAK=deger;BAYRAK2=deger" : olculecek kolu ayarla (A/B icin; TEK degisken kurali).
const SET = arg('--set', '');

const kod = [
    '(() => {',
    SET ? (SET.split(';').filter(Boolean).join('; ') + ';') : '',
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
    'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;',
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
    'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
    'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
    'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + SEED + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"tt", ally:true });',
    'startBattle();',
    'const HEDEF = ' + (SANIYE * 20) + ';',
    'const iz = {};',
    'const ph = SIM.headless; SIM.headless = true; let st = 0;',
    'try { while (SIM.tick < HEDEF && phase === PHASE.BATTLE) {',
    '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
    '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
    '  for (const u of SIM.units) {',
    '    if (u.dead || u.loaded) continue;',
    '    const a = iz[u.id] || (iz[u.id] = { tip: (STATS[u.type]||{}).id || String(u.type),',
    '      kirmizi: !!u.isRed, hava: !!u.isAir, x: [], y: [], aci: [] });',
    '    a.x.push(+u.x.toFixed(3)); a.y.push(+u.y.toFixed(3));',
    '    a.aci.push(+((u.facingAngle != null ? u.facingAngle : 0)).toFixed(4));',
    '  }',
    '} } finally { SIM.headless = ph; }',
    'return JSON.stringify({ iz: iz, tik: SIM.tick });',
    '})()'
].join('');

const ham = JSON.parse(vm.runInContext(kod, ctx, { filename: 'tt.js' }));
const iz = ham.iz;
const TIK_SN = 20;

function aciFark(a, b) { let f = Math.abs(a - b); while (f > Math.PI) f = Math.PI * 2 - f; return f; }

const R = [];
for (const id of Object.keys(iz)) {
    const p = iz[id];
    const n = p.x.length;
    if (n < 40) continue;
    const adim = [];
    let konumTers = 0, sonYon = null;
    for (let i = 1; i < n; i++) {
        const dx = p.x[i] - p.x[i - 1], dy = p.y[i] - p.y[i - 1];
        const d = Math.hypot(dx, dy);
        adim.push(d);
        if (d < 0.3) { sonYon = null; continue; }
        const yon = Math.atan2(dy, dx);
        if (sonYon != null && aciFark(yon, sonYon) > 2.0944) konumTers++;
        sonYon = yon;
    }
    // B: adim duzensizligi — YALNIZ hareket eden tiklerde (durus normal, karistirmayalim)
    const hrk = adim.filter(d => d >= 0.3);
    const ort = hrk.length ? hrk.reduce((a, b) => a + b, 0) / hrk.length : 0;
    const std = hrk.length > 1 ? Math.sqrt(hrk.reduce((a, b) => a + (b - ort) * (b - ort), 0) / (hrk.length - 1)) : 0;
    // dur-firla gecisi: hareketsiz tikten hareketli tike (ve tersi) gecis sayisi
    let gecis = 0;
    for (let i = 1; i < adim.length; i++) {
        const a0 = adim[i - 1] >= 0.3, a1 = adim[i] >= 0.3;
        if (a0 !== a1) gecis++;
    }
    // C: aci titremesi — >45 derece donus sayisi/sn ve YON DEGISTIREN donus (isaret tersinmesi)
    let aciDonus = 0, aciTers = 0, sonDelta = 0;
    for (let i = 1; i < p.aci.length; i++) {
        let d = p.aci[i] - p.aci[i - 1];
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        if (Math.abs(d) > 0.7854) aciDonus++;                       // 45 derece
        if (Math.abs(d) > 0.1745 && sonDelta * d < 0) aciTers++;     // 10 derece ustu ve YON tersine dondu
        if (Math.abs(d) > 0.1745) sonDelta = d;
    }
    const sn = n / TIK_SN;
    R.push({
        id: +id, tip: p.tip, kirmizi: p.kirmizi, hava: p.hava, tik: n,
        hrkTik: hrk.length, ortAdim: +ort.toFixed(2), stdAdim: +std.toFixed(2),
        dk: ort > 0 ? +(std / ort).toFixed(2) : 0,
        gecisSn: +(gecis / sn).toFixed(2),
        konumTersSn: +(konumTers / sn).toFixed(2),
        aciDonusSn: +(aciDonus / sn).toFixed(2),
        aciTersSn: +(aciTers / sn).toFixed(2)
    });
}

const hrk = R.filter(x => x.hrkTik >= 20);
const yaz = (baslik, dizi, alan, birim) => {
    console.log('');
    console.log('  ' + baslik);
    console.log('    ' + 'birim'.padEnd(22) + 'taraf'.padStart(7) + alan.padStart(12) + birim.padStart(22));
    for (const b of dizi.slice(0, 10)) {
        console.log('    ' + (b.tip + '#' + b.id).padEnd(22) + (b.kirmizi ? 'KIRMIZI' : 'MAVI').padStart(7) +
            String(b[alan]).padStart(12) +
            ('ort.adim ' + b.ortAdim + 'px  std ' + b.stdAdim).padStart(22));
    }
};

console.log('TITREME — TIK COZUNURLUGU  (tohum ' + SEED + ', ' + SANIYE + 'sn = ' + (SANIYE * 20) + ' tik/birim)');
console.log('  NOT: sim 20 Hz. Tikler ARASINDA birim durumu yoktur → 0.1ms uretilemez; bu EN INCE cozunurluk.');
console.log('  canli oyun da ayni 50ms sabit adimla kosar (main.js gameLoop) → tezgah sadik.');
console.log('  hareket eden birim: ' + hrk.length + ' / ' + R.length);

yaz('A. KONUM SALINIMI (ileri-geri, >120 derece) — es. >1/sn gozle titrer',
    hrk.slice().sort((a, b) => b.konumTersSn - a.konumTersSn), 'konumTersSn', '');
yaz('B. ADIM DUZENSIZLIGI (dur-firla gecisi/sn) — yuksekse "takilarak" yuruyor',
    hrk.slice().sort((a, b) => b.gecisSn - a.gecisSn), 'gecisSn', '');
yaz('C. ACI TITREMESI (yon degistiren >10 derece donus/sn) — govde saga sola oynuyor',
    hrk.slice().sort((a, b) => b.aciTersSn - a.aciTersSn), 'aciTersSn', '');

const ozet = (alan) => {
    const v = hrk.map(x => x[alan]).sort((a, b) => a - b);
    return v.length ? { ort: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2), medyan: v[Math.floor(v.length / 2)], enKotu: v[v.length - 1] } : {};
};
console.log('');
console.log('  OZET (hareket eden birimler):');
for (const a of ['konumTersSn', 'gecisSn', 'aciTersSn', 'aciDonusSn', 'dk']) {
    const o = ozet(a);
    console.log('    ' + a.padEnd(14) + 'ort ' + String(o.ort).padStart(7) + '   medyan ' + String(o.medyan).padStart(7) + '   en kotu ' + String(o.enKotu).padStart(7));
}
console.log('');
console.log('  OKUMA: A dusuk + B/C yuksek ise titreme KONUMDAN degil, dur-kalk ritminden ya da');
console.log('         govde donusunden geliyordur — cizim tarafinda cozulur, hareket mantiginda degil.');

fs.writeFileSync(OUT, JSON.stringify(IZYAZ ? { seed: SEED, saniye: SANIYE, birim: R, iz } : { seed: SEED, saniye: SANIYE, birim: R }, null, 1));
console.log('  -> ' + OUT + (IZYAZ ? '  (HAM tik izi dahil: x,y,aci)' : '  (--izyaz ile ham tik izi de yazilir)'));
