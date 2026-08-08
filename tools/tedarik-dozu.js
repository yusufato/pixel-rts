// TEDARIK DOZ-TEPKISI — FAZ 2: hangi birim tipi ne kadar KAZANDIRIYOR?
//
// FAZ 0 (tools/ordu-takasi.js, 192 mac) bilesiminin kaldirac oldugunu gosterdi:
// insan kompozisyonunun saf avantaji +596 (t 2.89), ordu-basi savrulma ±2700 (t 9.6'ya kadar).
// Ortalama kucuk ama VARYANS devasa -> "insanin ordusunu kopyala" degil, "hangi tip ne getiriyor"
// sorusu dogru soru.
//
// YONTEM: AI'in DOGAL ordusu once tarife cevrilir (RNG'siz, tekrarlanabilir taban). Sonra tek tip
// oynatilir (+N veya -N; butce en ucuz dolgudan alinir/oraya verilir) ve ESLESTIRILMIS fark olculur:
//     fark(tohum,rol) = marj(oynatilmis) - marj(taban)
// Rakip HER IKI KOLDA AYNI (AI dogal manifest, ayni tohum) -> tek degisken bizim tipimiz.
//
// TUZAK NOTLARI (bugun yasandi):
//  - Tarif kurulunca sezgisel zincirin TAMAMI kapanir; iki kolun da tarif modunda olmasi sart,
//    yoksa "tarif vs sezgisel" olcerim, "tip dozu" degil.
//  - Her kolda kadro basilir; istenen adet tutmuyorsa satir GECERSIZ isaretlenir (bind kaniti).
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 8)) || 8);
const ATLA = Math.max(0, Number(arg('--atla', 0)) || 0);
const SADECE = arg('--tip', '');           // "mlrs,attack_helo" gibi; bos = hepsi
const DOZ = Number(arg('--doz', 2)) || 2;  // kac adet eklenecek/cikarilacak
// CYBORG HAVUZU (docs/IKI-MAKINE.md): 100000-199999
const HAVUZ = []; for (let i = 0; i < 96; i++) HAVUZ.push(100000 + i * 137);
const TOHUMLAR = HAVUZ.slice(ATLA, ATLA + N);

const { ctx } = tezgahKur();

// ── 1) AI'in DOGAL ordusunun ORTALAMA kadrosu -> taban tarif ──
function dogalKadro(tohumlar) {
    const kod = [
        '(() => { const acc = {}; const seeds = ' + JSON.stringify(tohumlar) + ';',
        'for (const s of seeds) { if (typeof srand === "function") srand(s);',
        '  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        '  const m = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false });',
        '  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        '  for (const t of (m.types||[])) { const id = (STATS[t]||{}).id || t; acc[id] = (acc[id]||0) + 1; } }',
        'return JSON.stringify({ acc, n: seeds.length }); })()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'dk.js' }));
}

const MALIYET = (() => JSON.parse(vm.runInContext(
    '(() => { const o = {}; for (const k of Object.keys(STATS)) { const s = STATS[k]; if (s && s.id) o[s.id] = s.cost; } return JSON.stringify(o); })()',
    ctx, { filename: 'ml.js' })))();

const bedel = (k) => Object.entries(k).reduce((a, [id, n]) => a + (MALIYET[id] || 0) * n, 0);
// DOLGU: butce ayarlamasinda kullanilacak en ucuz muharip — hem ekleme hem cikarma bunu oynatir
const DOLGU = 'infantry';

// ── TABAN = HER (tohum,rol) icin AI'in O MACTAKI dogal kadrosu ──
// (Once ortalama alip yuvarlamayi denedim: seyrek birimler sifirlanip yerine 14 piyade dolgusu
//  geldi -> AI'in gercek ordusu DEGIL. Ortalama kadro bu isi bozuyor, tohum-basi kadro dogru.)
function dogalKadroTohum(seed, kirmiziSaldiran) {
    const kod = [
        '(() => {',
        'BATTLE_RECIPE_RED = null;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'const k = {}; for (const u of SIM.units) { if (u.dead || !u.isRed) continue; const id = (STATS[u.type]||{}).id || u.type; k[id] = (k[id]||0)+1; }',
        'return JSON.stringify(k); })()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'dt.js' }));
}

const TABANLAR = [];   // [{seed, rol, kadro}]
for (const s of TOHUMLAR) for (const rol of [true, false]) TABANLAR.push({ seed: s, rol, kadro: dogalKadroTohum(s, rol) });

console.log('TEDARIK DOZ-TEPKISI — AI dogal ordusu (tohum-basi) tarifeye cevrildi, tek tip oynatiliyor');
console.log('  ' + TOHUMLAR.length + ' tohum x 2 rol = ' + TABANLAR.length + ' eslestirilmis mac / doz');
console.log('  ornek taban (' + TABANLAR[0].seed + ', ' + (TABANLAR[0].rol ? 'saldiran' : 'savunan') + ', ' +
    bedel(TABANLAR[0].kadro) + 'TL / ' + Object.values(TABANLAR[0].kadro).reduce((a, b) => a + b, 0) + ' birim):');
console.log('    ' + Object.entries(TABANLAR[0].kadro).sort((a, b) => b[1] - a[1]).map(([a, b]) => a + '×' + b).join(' '));
console.log('  doz ±' + DOZ + '   dolgu birimi: ' + DOLGU + ' (' + MALIYET[DOLGU] + 'TL)');
console.log('');

// ── 2) oynatilmis kadro uret: tip X'e +d (butce DOLGU'dan alinir) ──
function oynat(taban, tip, d) {
    const k = { ...taban };
    if (d > 0) {
        k[tip] = (k[tip] || 0) + d;
        let kalan = (MALIYET[tip] || 0) * d, guard = 0;
        while (kalan > 0 && guard++ < 200) {
            // en ucuzdan basla ama DOLGU oncelikli
            const aday = (k[DOLGU] > 0 && tip !== DOLGU) ? DOLGU
                : Object.entries(k).filter(([id, n]) => n > 0 && id !== tip).sort((a, b) => (MALIYET[a[0]] || 0) - (MALIYET[b[0]] || 0)).map(x => x[0])[0];
            if (!aday) return null;
            k[aday]--; kalan -= (MALIYET[aday] || 0); if (!k[aday]) delete k[aday];
        }
    } else {
        const cik = Math.min(k[tip] || 0, -d);
        if (!cik) return null;
        k[tip] -= cik; if (!k[tip]) delete k[tip];
        let kalan = (MALIYET[tip] || 0) * cik, guard = 0;
        while (kalan >= (MALIYET[DOLGU] || 1) && guard++ < 200) { k[DOLGU] = (k[DOLGU] || 0) + 1; kalan -= (MALIYET[DOLGU] || 0); }
    }
    if (bedel(k) > 6500) return null;
    return k;
}

function tarifYap(kadro, rol) {
    return { ad: 'DOZ', rol, paylar: {}, tipPaylari: null, zorunlu: kadro, tavan: {}, artik: [] };
}

// ── 3) tek mac: BIZIM taraf tarif, RAKIP her zaman AI dogal manifest ──
function kos(seed, kadro, kirmiziSaldiran) {
    const tarif = tarifYap(kadro, kirmiziSaldiran ? 'attacker' : 'defender');
    const adet = Object.values(kadro).reduce((a, b) => a + b, 0);
    const kod = [
        '(() => {',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'BATTLE_RECIPE_RED = ' + JSON.stringify(tarif) + ';',   // BIZIM taraf = KIRMIZI
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        // RAKIP (MAVI) = AI dogal manifest — iki kolda da AYNI
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ' }), false, { source:"td", ally:true });',
        // KADRO startBattle ONCESINDE (drone_operator mac basinda kamikaze salar -> sahte "TUTMADI")
        'const kadroK = {}; for (const u of SIM.units) { if (u.dead || !u.isRed) continue; const id = (STATS[u.type]||{}).id || u.type; kadroK[id] = (kadroK[id]||0)+1; }',
        'startBattle();',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '} } finally { SIM.headless = ph; }',
        'const oK = battleArmyObservation(true), oM = battleArmyObservation(false);',
        'BATTLE_RECIPE_RED = null;',
        'return JSON.stringify({ marj: Math.round(oK.effectiveValue - oM.effectiveValue), kadroK });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'td.js' }));
}

// ── 4) TABAN kolu bir kez kosulur, tum tipler ona karsi eslestirilir ──
// TABAN da TARIF MODUNDA kosar; yoksa "tarif vs sezgisel" olcerim, "tip dozu" degil.
const tabanMarj = [];
{
    let uydu = true;
    for (const T of TABANLAR) {
        const r = kos(T.seed, T.kadro, T.rol);
        tabanMarj.push(r.marj);
        const bekle = Object.entries(T.kadro).sort().map(([a, b]) => a + '×' + b).join(' ');
        const ger = Object.entries(r.kadroK).sort().map(([a, b]) => a + '×' + b).join(' ');
        if (bekle !== ger) { uydu = false; console.log('    TUTMADI (' + T.seed + '): bekle=' + bekle + ' | gercek=' + ger); }
    }
    console.log('  BIND KANITI (taban kolu, ' + TABANLAR.length + ' kosu): tarif ' + (uydu ? 'UYDU' : '*** TUTMADI ***'));
    const o = tabanMarj.reduce((a, b) => a + b, 0) / tabanMarj.length;
    console.log('  taban marj ort ' + Math.round(o) + '  (n=' + tabanMarj.length + ')');
    console.log('');
}

// ── 5) tip tip doz-tepki ──
const TUM_TABAN_TIPLERI = Array.from(new Set(TABANLAR.flatMap(t => Object.keys(t.kadro))));
const TIPLER = SADECE ? SADECE.split(',').map(s => s.trim())
    : Array.from(new Set([...TUM_TABAN_TIPLERI, 'mlrs', 'attack_helo', 'drone_operator', 'ballistic_missile',
        'artillery', 'ucav', 'armed_uav', 'tank_destroyer', 'at_team', 'infantry', 'mbt', 'ifv',
        'commando', 'mortar_team', 'spaag', 'manpads_team', 'sam_battery', 'scout_vehicle',
        'recon_uav', 'ew_vehicle', 'counter_battery_radar', 'medic', 'engineer', 'supply_truck']))
        .filter(t => MALIYET[t] != null);

console.log('  ' + 'tip'.padEnd(22) + 'doz'.padStart(5) + 'FARK'.padStart(8) + 'std.hata'.padStart(10) +
    't'.padStart(7) + 'lehte'.padStart(8) + '  kadro');
const sonuc = [];
for (const tip of TIPLER) {
    for (const d of [DOZ, -DOZ]) {
        const fark = [];
        let uydu = true, atlanan = 0;
        for (let i = 0; i < TABANLAR.length; i++) {
            const T = TABANLAR[i];
            const k = oynat(T.kadro, tip, d);
            if (!k) { atlanan++; continue; }           // o kadroda cikarilacak birim yok
            const r = kos(T.seed, k, T.rol);
            fark.push(r.marj - tabanMarj[i]);
            if (uydu && (r.kadroK[tip] || 0) !== (k[tip] || 0)) uydu = false;
        }
        if (fark.length < 4) continue;                  // anlamli olcum icin cok az kadroda uygulanabildi
        const o = fark.reduce((a, b) => a + b, 0) / fark.length;
        const sd = Math.sqrt(fark.reduce((a, b) => a + (b - o) ** 2, 0) / Math.max(1, fark.length - 1));
        const se = sd / Math.sqrt(fark.length);
        sonuc.push({ tip, d, o, se, t: se ? o / se : 0, lehte: fark.filter(x => x > 0).length, n: fark.length, uydu, atlanan });
        console.log('  ' + tip.padEnd(22) + ((d > 0 ? '+' : '') + d).padStart(5) +
            ((o > 0 ? '+' : '') + Math.round(o)).padStart(8) + Math.round(se).toString().padStart(10) +
            (se ? (o / se).toFixed(2) : '-').padStart(7) +
            (fark.filter(x => x > 0).length + '/' + fark.length).padStart(8) +
            (atlanan ? '  (' + atlanan + ' kadroda yok)' : '') +
            (uydu ? '' : '  *** KADRO TUTMADI, GECERSIZ ***'));
    }
}

console.log('');
console.log('  ══ SIRALAMA (|t| >= 2 olanlar) ══');
for (const s of sonuc.filter(x => Math.abs(x.t) >= 2 && x.uydu).sort((a, b) => b.o - a.o))
    console.log('    ' + ((s.o > 0 ? '+' : '') + Math.round(s.o)).padStart(7) + '  t ' + s.t.toFixed(2).padStart(6) +
        '   ' + (s.d > 0 ? '+' : '') + s.d + ' ' + s.tip);
fs.mkdirSync(path.join(__dirname, '..', 'qa-runtime'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'qa-runtime', 'tedarik-dozu.json'),
    JSON.stringify({ tabanlar: TABANLAR, tabanMarj, sonuc, tohumlar: TOHUMLAR, doz: DOZ }, null, 1));
console.log('');
console.log('  qa-runtime/tedarik-dozu.json yazildi');
