// TEDARIK VEKTORU — FAZ 2b: kaba taramanin sinyallerini TEK degisiklikte birlestir, AYRIK tohumlarda olc.
//
// KAYNAK: tools/tedarik-dozu.js (8 tohum, HAVUZ[0..7], 656 mac). Tutarli sinyaller
// (+2 ve -2 dozu TERS isaret veren tipler) su vektoru veriyor:
//   AL   : supply_truck, drone_operator, mlrs, commando, spaag, tank_destroyer
//   BIRAK: recon_uav, ifv, scout_vehicle, mbt, ballistic_missile, sam_battery, ew_vehicle
//
// ONEMLI: vektor HAVUZ[0..7] uzerinde bulundu. Bu araç AYRIK dilimde (--atla 8) olcer.
// Ayni tohumlarda olcmek asiri-uydurmadir (bugun defalarca yasandi: 8 tohumda +1033/t 2.06 olan
// kural 24 BAGIMSIZ tohumda -333/t -0.70 cikti).
//
// TASARIM: her (tohum,rol) icin AI'in O MACTAKI dogal kadrosu taban; vektor ona uygulanir;
// rakip iki kolda da AYNI (AI dogal manifest). Eslestirilmis fark.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 24)) || 24);
const ATLA = Math.max(0, Number(arg('--atla', 8)) || 0);
const HAVUZ = []; for (let i = 0; i < 96; i++) HAVUZ.push(100000 + i * 137);
const TOHUMLAR = HAVUZ.slice(ATLA, ATLA + N);

// VEKTOR — dozu tarama isaretinden, siddeti kadro buyuklugune gore olculu tutuldu.
// (Tek seferde cok sey degistirmek "hangi parca ise yaradi" sorusunu cevapsiz birakir; ama once
//  BIRLESIK etki var mi diye bakmak dogru sira — yoksa 12 ayri teyit turu bosa gider.)
// OLCULEN KISIT (2026-08-08): BATTLE_INTEL4PRO_RED aciksa PRO-TEDARIK KATMANI tarifin ustune yazar ve
// KESIF asgarisini dayatir. recon_uav VEYA scout_vehicle cikarilirsa motor onlari GERI KOYUP parasini
// piyadeden alir -> istedigin ordu kurulmaz. Bagllanma olcumu (24 kosu, pro AÇIK):
//    recon-2 + scout-1 : 11/24   |   yalniz recon dokunma : 19/24   |   ikisine de dokunma : 24/24
// Bu yuzden vektor kesfe DOKUNMAZ. (Ilk surum dokunuyordu; +1047/t2.04 olcusu gecerliydi ama ETIKETI
// yanlisti - olcultigim sey "kesif geri konmus, parasi piyadeden alinmis" bir orduydu.)
const VARSAYILAN_VEKTOR = {
    supply_truck: +1, drone_operator: +2, mlrs: +1, commando: +1, spaag: +1, tank_destroyer: +1,
    ifv: -2, mbt: -1, ballistic_missile: -1, sam_battery: -1, ew_vehicle: -1
};
const VEKTOR = arg('--vektor', '') ? JSON.parse(arg('--vektor')) : VARSAYILAN_VEKTOR;

const { ctx } = tezgahKur();
const MALIYET = JSON.parse(vm.runInContext(
    '(() => { const o = {}; for (const k of Object.keys(STATS)) { const s = STATS[k]; if (s && s.id) o[s.id] = s.cost; } return JSON.stringify(o); })()',
    ctx, { filename: 'ml.js' }));
const bedel = (k) => Object.entries(k).reduce((a, [id, n]) => a + (MALIYET[id] || 0) * n, 0);

function dogalKadroTohum(seed, kirmiziSaldiran) {
    const kod = [
        '(() => { BATTLE_RECIPE_RED = null;',
        // TABAN da kolla AYNI bayraklarla kurulmali; pro katmani kadroyu degistiriyor (olculdu).
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'const k = {}; for (const u of SIM.units) { if (u.dead || !u.isRed) continue; const id = (STATS[u.type]||{}).id || u.type; k[id] = (k[id]||0)+1; }',
        'return JSON.stringify(k); })()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'dt.js' }));
}

// vektoru uygula: once CIKAR (butce serbest kalsin), sonra EKLE; artan para oncelik listesine gider
const EKLE_ONCELIK = ['drone_operator', 'mlrs', 'commando', 'supply_truck', 'spaag', 'tank_destroyer', 'at_team', 'mortar_team', 'infantry'];
function uygula(taban) {
    const k = { ...taban };
    for (const [tip, d] of Object.entries(VEKTOR)) {
        if (d >= 0) continue;
        const cik = Math.min(k[tip] || 0, -d);
        if (!cik) continue;
        k[tip] -= cik; if (!k[tip]) delete k[tip];
    }
    for (const [tip, d] of Object.entries(VEKTOR)) {
        if (d <= 0) continue;
        for (let i = 0; i < d; i++) {
            if (bedel(k) + (MALIYET[tip] || 0) > 6500) break;
            k[tip] = (k[tip] || 0) + 1;
        }
    }
    // artan parayi oncelik listesinden doldur (bos butce birakma - kol dezavantajli olur)
    let guard = 0;
    while (guard++ < 300) {
        const aday = EKLE_ONCELIK.find(t => MALIYET[t] != null && bedel(k) + MALIYET[t] <= 6500);
        if (!aday) break;
        k[aday] = (k[aday] || 0) + 1;
    }
    return k;
}

function kos(seed, kadro, kirmiziSaldiran) {
    const tarif = { ad: 'VEK', rol: kirmiziSaldiran ? 'attacker' : 'defender', paylar: {}, tipPaylari: null, zorunlu: kadro, tavan: {}, artik: [] };
    const kod = [
        '(() => {',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'BATTLE_RECIPE_RED = ' + JSON.stringify(tarif) + ';',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ' }), false, { source:"tv", ally:true });',
        // KADRO startBattle ONCESINDE okunur: drone_operator mac basinda kamikaze SALIYOR ve
        // listede olmayan loitering_munition beliriyor -> sonradan okursam bind kaniti sahte "TUTMADI" verir (yasandi).
        'const kadroK = {}; for (const u of SIM.units) { if (u.dead || !u.isRed) continue; const id = (STATS[u.type]||{}).id || u.type; kadroK[id] = (kadroK[id]||0)+1; }',
        'startBattle();',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '} } finally { SIM.headless = ph; }',
        'const oK = battleArmyObservation(true), oM = battleArmyObservation(false);',
        'BATTLE_RECIPE_RED = null;',
        'return JSON.stringify({ marj: Math.round(oK.effectiveValue - oM.effectiveValue), kadroK, bitisTik: SIM.tick });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'tv.js' }));
}

console.log('TEDARIK VEKTORU — AYRIK dilim (--atla ' + ATLA + '), ' + TOHUMLAR.length + ' tohum x 2 rol = ' + (TOHUMLAR.length * 2) + ' eslestirilmis mac');
console.log('  vektor: ' + Object.entries(VEKTOR).map(([k, v]) => (v > 0 ? '+' : '') + v + ' ' + k).join('  '));
console.log('  tohumlar: ' + TOHUMLAR[0] + '..' + TOHUMLAR[TOHUMLAR.length - 1] + ' (CYBORG havuzu)');
console.log('');

const fark = [], tabanM = [], vekM = [];
let uydu = 0, toplam = 0, ornek = null;
for (const s of TOHUMLAR) {
    for (const rol of [true, false]) {
        const taban = dogalKadroTohum(s, rol);
        const yeni = uygula(taban);
        if (!ornek) ornek = { taban, yeni };
        const A = kos(s, taban, rol);
        const B = kos(s, yeni, rol);
        toplam++;
        const bekle = Object.entries(yeni).sort().map(([a, b]) => a + '×' + b).join(' ');
        const ger = Object.entries(B.kadroK).sort().map(([a, b]) => a + '×' + b).join(' ');
        if (bekle === ger) uydu++;
        tabanM.push(A.marj); vekM.push(B.marj); fark.push(B.marj - A.marj);
    }
}

console.log('  BIND KANITI  ornek taban (' + bedel(ornek.taban) + 'TL): ' +
    Object.entries(ornek.taban).sort((a, b) => b[1] - a[1]).map(([a, b]) => a + '×' + b).join(' '));
console.log('               ornek YENI  (' + bedel(ornek.yeni) + 'TL): ' +
    Object.entries(ornek.yeni).sort((a, b) => b[1] - a[1]).map(([a, b]) => a + '×' + b).join(' '));
console.log('               tarif tuttu: ' + uydu + '/' + toplam + (uydu === toplam ? '' : '  *** EKSIK, dikkat ***'));
console.log('');
const ort = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const o = ort(fark);
const sd = Math.sqrt(fark.reduce((a, b) => a + (b - o) ** 2, 0) / Math.max(1, fark.length - 1));
const se = sd / Math.sqrt(fark.length);
console.log('  taban marj ort   ' + Math.round(ort(tabanM)));
console.log('  vektor marj ort  ' + Math.round(ort(vekM)));
console.log('');
console.log('  ══ ESLESTIRILMIS FARK ══');
console.log('     ' + (o > 0 ? '+' : '') + Math.round(o) + '   std.hata ' + Math.round(se) +
    '   t ' + (se ? (o / se).toFixed(2) : '-') + '   n=' + fark.length +
    '   lehte ' + fark.filter(x => x > 0).length + '/' + fark.length);
fs.writeFileSync(path.join(__dirname, '..', 'qa-runtime', 'tedarik-vektor.json'),
    JSON.stringify({ vektor: VEKTOR, tohumlar: TOHUMLAR, atla: ATLA, fark, tabanM, vekM, o, se }, null, 1));
console.log('');
console.log('  qa-runtime/tedarik-vektor.json yazildi');
