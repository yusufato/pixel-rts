// TEDARIK TABAN OLCUMU — motor degisikligi ONCESI/SONRASI eslestirilmis karsilastirma icin.
//
// Tedarik tahsisi (battleBuildArmyManifest) BAYRAKSIZ degistiriliyor (kullanici karari: "direkt
// altyapiyi duzelt yama yapma"). Bayrak olmadigi icin A/B tek kosuda yapilamaz; bu arac
// degisiklikten ONCE ve SONRA ayni tohumlarda kosulup dosyaya yazar, sonra eslestirilmis karsilastirilir.
//
// Olculen: (1) her tip icin ORDUDA-VAR yuzdesi + ort adet   (2) mac marji (kirmizi - mavi)
// Iki taraf da AI dogal manifesti; degisiklik iki tarafi da etkiler (adil).
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 24)) || 24);
const ATLA = Math.max(0, Number(arg('--atla', 32)) || 0);
const CIKTI = arg('--cikti', 'qa-runtime/tedarik-taban.json');
const KIYAS = arg('--kiyas', '');   // onceki dosya; verilirse eslestirilmis fark basilir
const HAVUZ = []; for (let i = 0; i < 96; i++) HAVUZ.push(100000 + i * 137);
const TOHUMLAR = HAVUZ.slice(ATLA, ATLA + N);

const { ctx } = tezgahKur();
const MALIYET = JSON.parse(vm.runInContext(
    '(() => { const o = {}; for (const k of Object.keys(STATS)) { const s = STATS[k]; if (s && s.id) o[s.id] = s.cost; } return JSON.stringify(o); })()',
    ctx, { filename: 'ml.js' }));

function kos(seed, kirmiziSaldiran) {
    const kod = [
        '(() => {',
        'BATTLE_RECIPE_RED = null;',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ' }), false, { source:"tt", ally:true });',
        'const kK = {}, kM = {}; let degerK = 0, degerM = 0;',
        'for (const u of SIM.units) { if (u.dead) continue; const id = (STATS[u.type]||{}).id || u.type; const c = (STATS[u.type]||{}).cost || 0;',
        '  if (u.isRed) { kK[id] = (kK[id]||0)+1; degerK += c; } else { kM[id] = (kM[id]||0)+1; degerM += c; } }',
        'startBattle();',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '} } finally { SIM.headless = ph; }',
        'const oK = battleArmyObservation(true), oM = battleArmyObservation(false);',
        'return JSON.stringify({ marj: Math.round(oK.effectiveValue - oM.effectiveValue), kK, kM, degerK, degerM, tik: SIM.tick });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'tt.js' }));
}

const kayit = [];
for (const s of TOHUMLAR) for (const rol of [true, false]) {
    const r = kos(s, rol);
    kayit.push({ seed: s, rol, marj: r.marj, kK: r.kK, kM: r.kM, degerK: r.degerK, degerM: r.degerM, tik: r.tik });
}

const ort = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);

// tip varligi (IKI taraf birlikte — degisiklik ikisini de etkiliyor)
function tipIstatistik(kayitlar) {
    const varlik = {}, adet = {}; let n = 0;
    for (const k of kayitlar) for (const kadro of [k.kK, k.kM]) {
        n++;
        for (const [id, c] of Object.entries(kadro)) { varlik[id] = (varlik[id] || 0) + 1; adet[id] = (adet[id] || 0) + c; }
    }
    return { varlik, adet, n };
}
const ist = tipIstatistik(kayit);

console.log('TEDARIK TABANI — ' + TOHUMLAR.length + ' tohum x 2 rol = ' + kayit.length + ' mac (' + (ist.n) + ' ordu)');
console.log('  tohumlar ' + TOHUMLAR[0] + '..' + TOHUMLAR[TOHUMLAR.length - 1] + '   cikti: ' + CIKTI);
console.log('');
console.log('  ' + 'birim'.padEnd(22) + 'fiyat'.padStart(7) + 'ORDUDA VAR'.padStart(12) + 'ort adet'.padStart(10));
const sat = Object.keys(MALIYET).map(id => ({ id, mal: MALIYET[id], p: (ist.varlik[id] || 0) / ist.n, a: (ist.adet[id] || 0) / ist.n }))
    .sort((a, b) => b.mal - a.mal);
for (const s of sat) {
    if (s.mal < 300) continue;
    console.log('  ' + s.id.padEnd(22) + String(s.mal).padStart(7) + ('%' + Math.round(s.p * 100)).padStart(12) + f2(s.a).padStart(10));
}
console.log('  ' + '(300TL alti)'.padEnd(22) + ''.padStart(7) +
    ('%' + Math.round(ort(sat.filter(x => x.mal < 300).map(x => x.p)) * 100)).padStart(12) +
    f2(sat.filter(x => x.mal < 300).reduce((a, b) => a + b.a, 0)).padStart(10) + '  <- ucuz sinif ort/toplam');
console.log('');
console.log('  ordu degeri: kirmizi ' + Math.round(ort(kayit.map(k => k.degerK))) + 'TL  mavi ' + Math.round(ort(kayit.map(k => k.degerM))) + 'TL');
console.log('  birim sayisi: kirmizi ' + f1(ort(kayit.map(k => Object.values(k.kK).reduce((a, b) => a + b, 0)))) +
    '  mavi ' + f1(ort(kayit.map(k => Object.values(k.kM).reduce((a, b) => a + b, 0)))));
console.log('  mac marji ort ' + Math.round(ort(kayit.map(k => k.marj))) + '   mac suresi ort ' + Math.round(ort(kayit.map(k => k.tik)) * 0.05) + 'sn');

fs.mkdirSync(path.join(__dirname, '..', 'qa-runtime'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', CIKTI), JSON.stringify({ tohumlar: TOHUMLAR, atla: ATLA, kayit }, null, 1));

if (KIYAS) {
    const onceki = JSON.parse(fs.readFileSync(path.join(__dirname, '..', KIYAS), 'utf8'));
    const harita = new Map(onceki.kayit.map(k => [k.seed + ':' + k.rol, k]));
    const fark = [];
    for (const k of kayit) { const o = harita.get(k.seed + ':' + k.rol); if (o) fark.push(k.marj - o.marj); }
    console.log('');
    console.log('  ══ KIYAS (' + KIYAS + ') — ESLESTIRILMIS FARK ══');
    if (!fark.length) { console.log('     eslesen tohum yok'); }
    else {
        const o = ort(fark);
        const sd = Math.sqrt(fark.reduce((a, b) => a + (b - o) ** 2, 0) / Math.max(1, fark.length - 1));
        const se = sd / Math.sqrt(fark.length);
        console.log('     ' + (o > 0 ? '+' : '') + Math.round(o) + '   std.hata ' + Math.round(se) +
            '   t ' + (se ? (o / se).toFixed(2) : '-') + '   n=' + fark.length +
            '   lehte ' + fark.filter(x => x > 0).length + '/' + fark.length);
        console.log('     NOT: degisiklik IKI TARAFI da etkiliyor -> marj farki ~0 beklenir.');
        console.log('           Asil olcut TIP VARLIGI tablosu ve (ayri kosulacak) insan-ordusuna karsi test.');
        const oi = tipIstatistik(onceki.kayit);
        console.log('');
        console.log('     ' + 'birim'.padEnd(22) + 'ONCE'.padStart(8) + 'SONRA'.padStart(8) + 'degisim'.padStart(10));
        for (const s of sat) {
            if (s.mal < 300) continue;
            const once = (oi.varlik[s.id] || 0) / oi.n, sonra = s.p;
            if (Math.abs(sonra - once) < 0.02) continue;
            console.log('     ' + s.id.padEnd(22) + ('%' + Math.round(once * 100)).padStart(8) + ('%' + Math.round(sonra * 100)).padStart(8) +
                ((sonra > once ? '+' : '') + Math.round((sonra - once) * 100) + ' puan').padStart(10));
        }
    }
}
