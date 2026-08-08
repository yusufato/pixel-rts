// YAMA FAKTORIYELI — 5 yama grubunun TUM kombinasyonlari (2^5 = 32 hucre).
//
// KULLANICI (2026-08-08): "bir yamanin etkisinden ziyade BIRDEN COK YAMANIN BIR ARADA kazandirdigi
// durumlar olabilir, onlari tek cati altina al."
// Tek tek olcum (birer-birer-degistir / OFAT) ETKILESIMI yapisal olarak goremez: A tek basina notr,
// B tek basina notr, ama A+B birlikte kazandiriyor olabilir — ya da ikisi ayni isi tekrarliyordur.
// Faktoriyel tasarim hem ANA ETKILERI hem IKILI ETKILESIMLERI ayni kosudan cikarir; ustelik ana
// etkiler 16'sar hucrenin ortalamasi oldugu icin tek-hucre gurultusunden cok daha keskin olur.
//
// GRUPLAR (js/globals.js BATTLE_KADRO_YAMALARI):
//   imza taban hava mizrak omurga
// TABAN HUCRE: hepsi ACIK (bugunku hal). Her hucre ona karsi ESLESTIRILMIS olculur.
// TARAF-BASI (tuzak B3): yamalar yalniz KIRMIZIDA degisir, MAVI her zaman tam yamali.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 16)) || 16);
const ATLA = Math.max(0, Number(arg('--atla', 56)) || 0);
const HAVUZ = []; for (let i = 0; i < 96; i++) HAVUZ.push(100000 + i * 137);
const TOHUMLAR = HAVUZ.slice(ATLA, ATLA + N);
const GRUPLAR = ['imza', 'taban', 'hava', 'mizrak', 'omurga'];

const { ctx } = tezgahKur();

function kos(seed, kirmiziSaldiran, kume) {
    const kod = [
        '(() => {',
        'BATTLE_RECIPE_RED = null;',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        // KIRMIZI konuslandirmasi bu kume ile
        'BATTLE_KADRO_YAMALARI = ' + JSON.stringify(kume) + ';',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        // MAVI her zaman TAM yamali
        'BATTLE_KADRO_YAMALARI = { imza:true, taban:true, hava:true, mizrak:true, omurga:true };',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ' }), false, { source:"yf", ally:true });',
        'const kK = {}; let degerK = 0;',
        'for (const u of SIM.units) { if (u.dead || !u.isRed) continue; const id = (STATS[u.type]||{}).id || u.type; kK[id] = (kK[id]||0)+1; degerK += (STATS[u.type]||{}).cost || 0; }',
        'startBattle();',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '} } finally { SIM.headless = ph; }',
        'const oK = battleArmyObservation(true), oM = battleArmyObservation(false);',
        'return JSON.stringify({ marj: Math.round(oK.effectiveValue - oM.effectiveValue), kK, degerK });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'yf.js' }));
}

const HEPSI_ACIK = { imza: true, taban: true, hava: true, mizrak: true, omurga: true };
const hucreler = [];
for (let m = 0; m < 32; m++) {
    const kume = {}; GRUPLAR.forEach((g, i) => { kume[g] = !((m >> i) & 1); });   // bit=1 -> KAPALI
    hucreler.push({ maske: m, kume, kapali: GRUPLAR.filter(g => !kume[g]) });
}

console.log('YAMA FAKTORIYELI — 2^5 = 32 hucre x ' + TOHUMLAR.length + ' tohum x 2 rol = ' + (32 * TOHUMLAR.length * 2) + ' mac');
console.log('  gruplar: ' + GRUPLAR.join(', ') + '   (kapsam disi: pro on-kosul kurallari)');
console.log('  tohumlar ' + TOHUMLAR[0] + '..' + TOHUMLAR[TOHUMLAR.length - 1] + '   taraf-basi: yalniz KIRMIZI');
console.log('');

// TABAN: hepsi acik
const tabanMarj = [];
for (const s of TOHUMLAR) for (const rol of [true, false]) tabanMarj.push(kos(s, rol, HEPSI_ACIK).marj);
const ort = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log('  TABAN (hepsi acik) marj ort ' + Math.round(ort(tabanMarj)) + '   n=' + tabanMarj.length);
console.log('');

// ILERLEME + ARA KAYIT (2026-08-08 dersi): 1024 maclik bir kosuyu ilerleme loglamadan baslatmistim;
// 2 saat boyunca "ne kadar kaldi" gorunmedi ve kesilse tum veri gidecekti. Artik her hucre bitince
// satir basilir (writeSync ile ANINDA diske) ve ara sonuc dosyaya yazilir.
const ARA = path.join(__dirname, '..', 'qa-runtime', 'yama-faktoriyel-ARA.json');
const yaz = (s) => { try { fs.writeSync(1, s + '\n'); } catch (e) { console.log(s); } };
const t0 = process.hrtime.bigint();
const sonuc = [];
let yapilan = 0;
const toplamHucre = hucreler.filter(h => h.kapali.length).length;
for (const h of hucreler) {
    if (!h.kapali.length) { sonuc.push({ ...h, o: 0, se: 0, fark: tabanMarj.map(() => 0), birim: null, deger: null }); continue; }
    const fark = []; let i = 0, birimTop = 0, degerTop = 0;
    for (const s of TOHUMLAR) for (const rol of [true, false]) {
        const r = kos(s, rol, h.kume);
        fark.push(r.marj - tabanMarj[i]); i++;
        birimTop += Object.values(r.kK).reduce((a, b) => a + b, 0); degerTop += r.degerK;
    }
    const o = ort(fark);
    const sd = Math.sqrt(fark.reduce((a, b) => a + (b - o) ** 2, 0) / Math.max(1, fark.length - 1));
    const kayit = { ...h, o, se: sd / Math.sqrt(fark.length), fark, birim: birimTop / fark.length, deger: degerTop / fark.length };
    sonuc.push(kayit);
    yapilan++;
    const gecen = Number(process.hrtime.bigint() - t0) / 1e9;
    const kalan = gecen / yapilan * (toplamHucre - yapilan);
    yaz('    [' + String(yapilan).padStart(2) + '/' + toplamHucre + '] ' + h.kapali.join('+').padEnd(34) +
        ((o > 0 ? '+' : '') + Math.round(o)).padStart(7) + '  t ' + (kayit.se ? (o / kayit.se).toFixed(2) : '-').padStart(6) +
        '   gecen ' + Math.round(gecen / 60) + 'dk, tahmini kalan ' + Math.round(kalan / 60) + 'dk');
    try { fs.writeFileSync(ARA, JSON.stringify({ tohumlar: TOHUMLAR, gruplar: GRUPLAR, tabanMarj, sonuc }, null, 1)); } catch (e) { /* ara kayit kritik degil */ }
}

console.log('  ── HUCRELER (kapatmanin etkisi, kirmizi lehine) ──');
console.log('  ' + 'kapatilanlar'.padEnd(34) + 'etki'.padStart(8) + 'std.hata'.padStart(9) + 't'.padStart(7) + 'lehte'.padStart(8) + 'birim'.padStart(7) + 'deger'.padStart(8));
for (const r of sonuc.slice().sort((a, b) => b.o - a.o)) {
    if (!r.kapali.length) continue;
    console.log('  ' + r.kapali.join('+').padEnd(34) + ((r.o > 0 ? '+' : '') + Math.round(r.o)).padStart(8) +
        Math.round(r.se).toString().padStart(9) + (r.se ? (r.o / r.se).toFixed(2) : '-').padStart(7) +
        (r.fark.filter(x => x > 0).length + '/' + r.fark.length).padStart(8) +
        r.birim.toFixed(1).padStart(7) + Math.round(r.deger).toString().padStart(8));
}

// ── ANA ETKILER: her grup icin, o grup KAPALI olan 16 hucrenin ortalamasi - ACIK olan 16 hucrenin ortalamasi
console.log('');
console.log('  ── ANA ETKILER (16+16 hucre ortalamasi — tek hucreden cok daha keskin) ──');
console.log('  ' + 'grup'.padEnd(12) + 'KAPATMANIN ETKISI'.padStart(19) + 'std.hata'.padStart(10) + 't'.padStart(7));
const anaEtki = {};
for (const g of GRUPLAR) {
    const kapali = sonuc.filter(r => !r.kume[g]), acik = sonuc.filter(r => r.kume[g]);
    // her hucrenin kendi fark dizisi var; ana etki = tum farklarin havuzu
    const A = kapali.flatMap(r => r.fark), B = acik.flatMap(r => r.fark);
    const oA = ort(A), oB = ort(B), d = oA - oB;
    const vA = A.reduce((a, b) => a + (b - oA) ** 2, 0) / Math.max(1, A.length - 1);
    const vB = B.reduce((a, b) => a + (b - oB) ** 2, 0) / Math.max(1, B.length - 1);
    const se = Math.sqrt(vA / A.length + vB / B.length);
    anaEtki[g] = { d, se, t: se ? d / se : 0 };
    console.log('  ' + g.padEnd(12) + ((d > 0 ? '+' : '') + Math.round(d)).padStart(19) + Math.round(se).toString().padStart(10) +
        (se ? (d / se).toFixed(2) : '-').padStart(7));
}

// ── IKILI ETKILESIMLER: (ikisi de kapali) - (yalniz A) - (yalniz B) + (ikisi de acik)
console.log('');
console.log('  ── IKILI ETKILESIMLER (pozitif = birlikte kapatmak, ayri ayri toplamindan IYI) ──');
const et = [];
for (let i = 0; i < GRUPLAR.length; i++) for (let j = i + 1; j < GRUPLAR.length; j++) {
    const a = GRUPLAR[i], b = GRUPLAR[j];
    const grup = (ka, kb) => sonuc.filter(r => (!r.kume[a]) === ka && (!r.kume[b]) === kb).flatMap(r => r.fark);
    const [KK, KA, AK, AA] = [grup(true, true), grup(true, false), grup(false, true), grup(false, false)];
    const inter = ort(KK) - ort(KA) - ort(AK) + ort(AA);
    const sev = (x) => { const o = ort(x); return x.reduce((s, y) => s + (y - o) ** 2, 0) / Math.max(1, x.length - 1) / x.length; };
    const se = Math.sqrt(sev(KK) + sev(KA) + sev(AK) + sev(AA));
    et.push({ ad: a + '×' + b, inter, se, t: se ? inter / se : 0 });
}
for (const x of et.sort((p, q) => Math.abs(q.t) - Math.abs(p.t)))
    console.log('  ' + x.ad.padEnd(20) + ((x.inter > 0 ? '+' : '') + Math.round(x.inter)).padStart(9) +
        Math.round(x.se).toString().padStart(10) + (x.se ? (x.inter / x.se).toFixed(2) : '-').padStart(7));

fs.writeFileSync(path.join(__dirname, '..', 'qa-runtime', 'yama-faktoriyel.json'),
    JSON.stringify({ tohumlar: TOHUMLAR, gruplar: GRUPLAR, tabanMarj, sonuc, anaEtki, etkilesim: et }, null, 1));
console.log('');
console.log('  qa-runtime/yama-faktoriyel.json yazildi');
