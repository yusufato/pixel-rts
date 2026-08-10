// SOMURU ARAMASI — insan verisi OLMADAN, motorun kendi sayilarindan sömürü bul.
//
// KULLANICI CERCEVESI (2026-08-09): "insan mac ornegi cok az ve cok gurultulu — bir mac bir birimi
// 10 kat iyi kullanirim, diger mac kullanmam. Buyuk sirketler de oyunu cikarmadan once gercek
// insanlarla oynamiyordur; biz de insanla oynamadan insan gibi oynatabiliriz."
// DOGRU: sömürü INSANDA degil MEKANIKTE. Insan onu yalnizca KESFEDIYOR.
// Ornek: helo menzili 675, kisa menzilli AD 825-975, uzun menzilli SAM nadir → "kisa menzilli
// AD'den uzak dur" bosluğu motorun SAYILARINDA duruyor, kullanici bulmasa da orada.
//
// AYRICA OLCULDU (ayni gun): insan maclarindan cikarilan "pro insana karsi 7x kotu" hipotezi
// somurucu sinavini GECEMEDI ve beyin ile oyun-tarzi ic ice cikti. Yani insan maclarindan
// KALDIRAC OLCULMEZ; onlar sadece NEREYE BAKILACAGINI soyler.
//
// YONTEM — IKI ASAMALI ELEME (marj gurultusu std ~3100; tek asamada karar VERILEMEZ):
//   ASAMA 1 (TARAMA): her aday az tohumla kosar, amac SIRALAMA (karar degil).
//   ASAMA 2 (DERIN)  : ilk N aday cok tohumla kosar, karar |t|>=2 barina gore.
// AMAC FONKSIYONU: kod-AI'in marji (DUSUK = somuru guclu). Eslestirilmis: ayni tohum, ayni rol.
//
// ARAMA UZAYI (v1): ORDU KOMPOZISYONU. Her aday, bir birim sinifini one cikaran tarif.
// Adaylar ELLE SECILMEZ — rosterdeki her birim icin otomatik uretilir (kapsam garantisi).
// Somurucunun DAVRANISI bu surumde kod-AI'dir; yani "AI kendi taktigiyle bile su orduyu
// yenemiyor" sorusunu sorar. Davranis betikleri (js/BattleExploiters.js) v2'de eklenecek.
//
// DENGE DOKUNULMAZ (kullanici kurali): arama "su birim cok guclu" derse RAPOR edilir, birim
// zayiflatilmaz.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const TARAMA_MAC = Math.max(1, Number(arg('--tarama', 3)) || 3);   // asama-1 tohum sayisi
const DERIN_MAC = Math.max(1, Number(arg('--derin', 16)) || 16);   // asama-2 tohum sayisi
const DERIN_N = Math.max(1, Number(arg('--ilkn', 5)) || 5);        // kac aday derine kalir
const BEYIN = arg('--beyin', 'pro');
const HAVUZ = []; for (let i = 0; i < 128; i++) HAVUZ.push(100000 + i * 223);
const yaz = (s) => { try { fs.writeSync(1, s + '\n'); } catch (e) { console.log(s); } };
const ARA = path.join(__dirname, '..', 'qa-runtime', 'somuru-arama-ARA.json');

const { ctx } = tezgahKur();
const AD = JSON.parse(vm.runInContext('JSON.stringify(UNIT_ID_BY_INDEX)', ctx));
const ST = JSON.parse(vm.runInContext(`JSON.stringify(Object.fromEntries(Object.entries(STATS).map(([k,v]) => [k, {
    kat: v.category, cost: v.cost||0, silahli: !!(v.weapons && v.weapons.length)
}])))`, ctx));

// ADAY URETIMI — rosterdeki HER birim icin bir "agirlikli" tarif (elle liste YOK → kapsam garantili).
// `zorunlu` degil `tipPaylari` kullanilir: butce icinde o birime agirlik verilir, ordu yine dengeli
// kalir (tek-tip ordu gercekci degil ve tedarik zincirini bozar).
// STATS kategorisi -> tarif kategorisi (air/uav ayri kategoriler; roster kategorisi birebir esit degil)
const RECIPE_KAT = { infantry: 'infantry', armor: 'armor', indirect: 'indirect', air_defense: 'air_defense',
    air: 'air', uav: 'uav', recon: 'recon', support: 'support', logistics: 'logistics', command: 'command' };
const ADAYLAR = [{ ad: 'TABAN (sezgisel ordu)', tarif: null }];
for (const t of Object.keys(ST).map(Number).sort((a, b) => a - b)) {
    const s = ST[t];
    if (!s || !s.cost || !AD[t]) continue;
    if (!s.silahli) continue;                       // silahsiz destek tek basina somuru olamaz
    // ⚠ ARAC HATASI ve DUZELTMESI: `tipPaylari` GLOBAL bir tip filtresidir — listede olmayan tip
    // agirlik 0 alir. Ilk surumde `{ [ad]: 6 }` yazmistim → ordu 3 MBT'den ibaret kaldi, butcenin
    // 5000₺'si harcanmadi ve HER aday silindi (mavi kalan 0.0 vs taban 18.5). Tablo anlamsizdi.
    // DOGRUSU: TUM tipler 1 agirlikla listelenir, yalniz vurgulanan tip yukseltilir.
    const tp = {};
    for (const q of Object.keys(ST).map(Number)) { if (AD[q] && ST[q].cost) tp[AD[q]] = 1; }
    tp[AD[t]] = 6;
    // KATEGORI PAYI da yukseltilir: yalniz tip-agirligi vermek yetmiyordu (armor payi 0.2 tavan
    // koyuyordu → "mbt agirlikli" orduda 2 MBT cikti). Aday, gercek bir DOKTRIN EGILIMI olmali.
    // ⚠ UCUNCU ARAC HATASI ve DUZELTMESI: taban paylarda `air`/`uav` YOKTU → tarif HIC UCAK ALMIYORDU.
    // Sonuc: attack_helo / armed_uav / loitering_munition adaylarinda o birimden SIFIR tane vardi ve
    // ucu de BIREBIR AYNI marji verdi (−30) — tabloda bu esitlik yakalandi. Bugunun tum olcumleri
    // helonun AI'in 1 numarali katili oldugunu soylerken arama uzayinda ucak olmamasi kabul edilemez.
    const TABAN_PAY = { infantry: 0.22, armor: 0.18, indirect: 0.17, air_defense: 0.09,
                        support: 0.12, recon: 0.09, air: 0.08, uav: 0.05 };
    const kat = RECIPE_KAT[s.kat] || null;
    const paylar = { ...TABAN_PAY };
    if (kat && paylar[kat] != null) {
        const artis = 0.45 - paylar[kat];
        if (artis > 0) {
            paylar[kat] = 0.45;
            const digerler = Object.keys(paylar).filter(k => k !== kat);
            const toplam = digerler.reduce((a, k) => a + paylar[k], 0);
            for (const k of digerler) paylar[k] = Math.max(0.02, paylar[k] - artis * (paylar[k] / toplam));
        }
    }
    ADAYLAR.push({
        ad: AD[t], tip: t,
        tarif: { ad: 'agirlikli-' + AD[t], tipPaylari: tp, paylar }
    });
}

function kos(seed, kirmiziSaldiran, tarif) {
    const kod = `(() => {
    BATTLE_RECIPE_RED = null;
    BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
    BATTLE_INTEL4PRO_RED = ${BEYIN === 'pro'}; BATTLE_INTEL4PRO_BLUE = true;
    BATTLE_INTEL4PRO_DELTAS_RED = null; BATTLE_INTEL4PRO_DELTAS_BLUE = null;
    BATTLE_AD_WEIGHT_MULT_RED = 1; BATTLE_AD_WEIGHT_MULT_BLUE = 1;
    BATTLE_EXPLOITER_RED = null; BATTLE_EXPLOITER_BLUE = null;
    if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${seed}, attackerSide:${kirmiziSaldiran},
        durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
    battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
        brainIntel4:true, isAttacker:${!kirmiziSaldiran}${tarif ? ', recipe: ' + JSON.stringify(tarif) : ''} }),
        false, { source:'sa', ally:true });
    startBattle();
    const ph = SIM.headless; SIM.headless = true; let st = 0;
    try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {
        st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
        if (typeof updateSupport === 'function') updateSupport(BATTLE_TICK_SEC, st);
    } } finally { SIM.headless = ph; }
    const oK = battleArmyObservation(true), oM = battleArmyObservation(false);
    return JSON.stringify({ marj: Math.round(oK.effectiveValue - oM.effectiveValue),
        kirmiziKalan: SIM.units.filter(u => u.isRed && !u.dead).length,
        maviKalan: SIM.units.filter(u => !u.isRed && !u.dead).length });
})()`;
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'sa.js' }));
}

function olc(tarif, nTohum) {
    const marjlar = [];
    let kK = 0, mK = 0, n = 0;
    for (let i = 0; i < nTohum; i++) {
        for (const rol of [true, false]) {
            const r = kos(HAVUZ[i], rol, tarif);
            marjlar.push(r.marj); kK += r.kirmiziKalan; mK += r.maviKalan; n++;
        }
    }
    const o = marjlar.reduce((a, b) => a + b, 0) / marjlar.length;
    const sd = Math.sqrt(marjlar.reduce((a, b) => a + (b - o) ** 2, 0) / Math.max(1, marjlar.length - 1));
    return { marj: o, se: sd / Math.sqrt(marjlar.length), n: marjlar.length,
             kirmiziKalan: kK / n, maviKalan: mK / n, marjlar };
}

yaz('SOMURU ARAMASI — kod-AI [' + BEYIN + '] hangi ORDUYA karsi cuvalliyor?');
yaz('  ' + ADAYLAR.length + ' aday  ·  ASAMA1 ' + TARAMA_MAC + ' tohum x2 rol  ·  ASAMA2 ilk ' +
    DERIN_N + ' aday ' + DERIN_MAC + ' tohum x2 rol');
yaz('  AMAC: kod-AI marjini DUSURMEK (dusuk = somuru guclu). Insan verisi KULLANILMIYOR.');
yaz('');

// ── ASAMA 1: TARAMA (siralama icin; KARAR DEGIL) ──
const asama1 = [];
for (let i = 0; i < ADAYLAR.length; i++) {
    const a = ADAYLAR[i];
    const r = olc(a.tarif, TARAMA_MAC);
    asama1.push({ ...a, ...r });
    yaz('  [' + (i + 1) + '/' + ADAYLAR.length + '] ' + a.ad.padEnd(22) +
        ' marj ' + Math.round(r.marj).toString().padStart(6) +
        '   kalan K/M ' + r.kirmiziKalan.toFixed(1) + '/' + r.maviKalan.toFixed(1));
    fs.writeFileSync(ARA, JSON.stringify(asama1, null, 1));
}
const taban1 = asama1.find(x => x.tarif === null);
asama1.sort((a, b) => a.marj - b.marj);
yaz('');
yaz('  ══ ASAMA 1 SIRALAMA (marj DUSUK = AI zorlaniyor) ══   TABAN marj ' + Math.round(taban1.marj));
for (const a of asama1.slice(0, 12)) {
    yaz('    ' + a.ad.padEnd(22) + Math.round(a.marj).toString().padStart(7) +
        '   tabana gore ' + Math.round(a.marj - taban1.marj).toString().padStart(6));
}
yaz('');
yaz('  UYARI: bu siralama ' + (TARAMA_MAC * 2) + ' macliktir ve KARAR DEGILDIR (marj std ~3100).');

// ── ASAMA 2: DERIN (karar) ──
const secilen = asama1.filter(a => a.tarif !== null).slice(0, DERIN_N);
yaz('');
yaz('  ══ ASAMA 2 — ilk ' + secilen.length + ' aday, ' + (DERIN_MAC * 2) + ' mac ══');
const tabanDerin = olc(null, DERIN_MAC);
yaz('    TABAN            marj ' + Math.round(tabanDerin.marj) + '  se ' + Math.round(tabanDerin.se));
const sonuc = [];
for (const a of secilen) {
    const r = olc(a.tarif, DERIN_MAC);
    // eslestirilmis fark: ayni tohum+rol sirasi
    const fark = r.marjlar.map((m, i) => m - tabanDerin.marjlar[i]);
    const o = fark.reduce((x, y) => x + y, 0) / fark.length;
    const sd = Math.sqrt(fark.reduce((x, y) => x + (y - o) ** 2, 0) / Math.max(1, fark.length - 1));
    const se = sd / Math.sqrt(fark.length);
    sonuc.push({ ad: a.ad, marj: r.marj, fark: o, se, t: se ? o / se : 0, maviKalan: r.maviKalan });
    yaz('    ' + a.ad.padEnd(16) + ' marj ' + Math.round(r.marj).toString().padStart(6) +
        '   TABANA GORE ' + Math.round(o).toString().padStart(6) + '  se ' + Math.round(se).toString().padStart(5) +
        '  t ' + (se ? (o / se).toFixed(2) : '-').padStart(6) +
        (se && Math.abs(o / se) >= 2 && o < 0 ? '   *** SOMURU ***' : ''));
    fs.writeFileSync(ARA, JSON.stringify({ asama1, sonuc }, null, 1));
}
yaz('');
sonuc.sort((a, b) => a.fark - b.fark);
const kazanan = sonuc.filter(s => s.t <= -2);
yaz('  ══ SONUC ══');
if (kazanan.length) {
    yaz('    HAVUZA GIRECEK (|t|>=2 ve AI aleyhine): ' + kazanan.map(k => k.ad + ' (' + Math.round(k.fark) + ', t ' + k.t.toFixed(2) + ')').join(', '));
} else {
    yaz('    Barı gecen aday YOK. En iyisi: ' + (sonuc[0] ? sonuc[0].ad + ' (' + Math.round(sonuc[0].fark) + ', t ' + sonuc[0].t.toFixed(2) + ')' : '-'));
    yaz('    YORUM: ya kompozisyon tek basina somuru uretmiyor (davranis gerekiyor → v2),');
    yaz('           ya da ' + (DERIN_MAC * 2) + ' mac bu buyuklukteki etki icin yetmiyor.');
}
fs.writeFileSync(path.join(__dirname, '..', 'qa-runtime', 'somuru-arama.json'), JSON.stringify({ asama1, sonuc }, null, 1));
