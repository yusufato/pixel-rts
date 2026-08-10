// SOMURUCU HAVUZ TEZGAHI — kod-AI'i INSAN GIBI oynayan dar botlara karsi sina.
//
// NEDEN: mevcut tezgah AYNA (intel4 vs intel4-pro) ve INSANA KOR. Olculdu: tezgahta AI makul
// gorunuyor ama kullanici 26 gercek macta **4.20:1** takasla yeniyor. Ayna sonucuna gore ayarlanan
// her sey yanlis rakibe gore ayarlanmis oluyor (bugun UC kaldirac bu yuzden bos cikti olabilir).
//
// SOMURUCU #1 — helo_harass (js/BattleExploiters.js). Olcumun dogrudan tercumesi:
//   helo vurus aninda %81 GORUNUR ama AD menzilinde yalniz %41 → somuru gorunmezlik degil
//   MENZIL DISI KALMAK; helo->en yakin AD medyan 1188px.
//
// OLCUT — KOD-AI'IN somurucu karsisindaki hali:
//   E1 marj (kod-AI lehine +)          : temel sonuc
//   E2 helo kaynakli kayip payimiz     : gercek maclarda %22 idi — somurucu bunu URETEBILIYOR MU?
//   E3 dusman helosunu dusurme         : kac tane indirebiliyoruz
//   E4 helonun vurulabilirligi         : somurucu menzil disinda kalabiliyor mu (gercekte %34)
//   BAGLANMA: BATTLE_BALANCE.exploiterHeloBind — 0 ise bot HIC calismadi, tablo anlamsiz.
//
// KALIBRASYON HEDEFI: somurucu, kullanicinin imzasini TAKLIT etmeli. E2 gercek %22'ye yakin
// degilse bot yeterince iyi degildir — once BOTU duzeltiriz, sonra AI'i olceriz.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N_MAC = Math.max(1, Number(arg('--mac', 8)) || 8);
const SOMURU = arg('--somuru', 'helo_harass');
const HELO_ADET = Math.max(1, Number(arg('--helo', 3)) || 3);
// SINANAN BEYIN: 'pro' (intel4+pro) | 'intel4' (yalniz intel4). GERCEK MACLARDA (etiketli, n=3/2)
// kullaniciya karsi intel4 takas 1.38:1, intel4-pro 10.22:1 — yani duz intel4 ~7x IYI.
// Ayna tezgahinda ikisi esitti (%44-48). Somurucu SADIKSA bu ayrimi O DA gostermeli.
const BEYIN = arg('--beyin', 'pro');
// KIP:
//  'bot'      → bot KAPALI vs ACIK (somurucunun kendi etkisi; kalibrasyon icin)
//  'kaldirac' → bot HER IKI KOLDA ACIK, degisen tek sey KALDIRAC (asil soru: somurucuye karsi ise yariyor mu?)
const KIP = arg('--kip', 'bot');
const KALDIRAC = arg('--kaldirac', 'adUmbrella');   // adUmbrella | adPayi | arama
const HAVUZ = []; for (let i = 0; i < 128; i++) HAVUZ.push(100000 + i * 211);
const TOHUMLAR = HAVUZ.slice(0, N_MAC);
const yaz = (s) => { try { fs.writeSync(1, s + '\n'); } catch (e) { console.log(s); } };
const { ctx } = tezgahKur();

// SOMURUCUNUN ORDUSU: helo agirlikli tarif. Genel-amacli DEGIL — tek somuruyu icra edecek kadar.
// `zorunlu` tam adet verir; kalan butce yumusak destege gider (somurucu "iyi ordu" kurmaz).
const TARIF = {
    ad: 'helo-tacizcisi',
    zorunlu: { attack_helo: HELO_ADET },
    paylar: { infantry: 0.4, armor: 0.2, support: 0.2, indirect: 0.2 }
};

function kos(seed, kirmiziSaldiran, acik) {
    const kod = `(() => {
    BATTLE_RECIPE_RED = null;
    BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
    BATTLE_INTEL4PRO_RED = ${BEYIN === 'pro'}; BATTLE_INTEL4PRO_BLUE = true;
    BATTLE_INTEL4PRO_DELTAS_RED = ${KIP === 'kaldirac' && KALDIRAC === 'adUmbrella' && acik ? "{ adUmbrella: true }" : 'null'};
    BATTLE_INTEL4PRO_DELTAS_BLUE = null;
    BATTLE_AD_WEIGHT_MULT_RED = ${KIP === 'kaldirac' && KALDIRAC === 'adPayi' && acik ? 1.5 : 1}; BATTLE_AD_WEIGHT_MULT_BLUE = 1;
    BATTLE_SEARCH_UNCERTAIN = ${KIP === 'kaldirac' && KALDIRAC === 'arama' && acik};
    BATTLE_SEARCH_UNCERTAIN_BASE = 75;
    // SOMURUCU = MAVI (mudafi/oyuncu tarafi). KIRMIZI = sinanan kod-AI.
    // 'kaldirac' kipinde bot HER IKI KOLDA acik; degisen tek sey yukaridaki kaldirac.
    BATTLE_EXPLOITER_RED = null;
    BATTLE_EXPLOITER_BLUE = ${(KIP === 'kaldirac' || acik) ? "'" + SOMURU + "'" : 'null'};
    if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
    if (typeof BATTLE_BALANCE !== 'undefined') { BATTLE_BALANCE.on = true; BATTLE_BALANCE.exploiterHeloBind = 0;
        BATTLE_BALANCE.searchUncertainBind = 0; BATTLE_BALANCE.adUmbrellaBind = 0; }
    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${seed}, attackerSide:${kirmiziSaldiran},
        durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
    // MAVI ordu TARIFTEN (iki kolda da AYNI ordu — degisen tek sey botun davranisi)
    battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true,
        recipe: ${JSON.stringify(TARIF)} }), false, { source:'som', ally:true });
    startBattle();

    const heloTip = Object.keys(STATS).map(Number).filter(t => UNIT_ID_BY_INDEX[t] === 'attack_helo');
    const heloBaslangic = SIM.units.filter(u => !u.isRed && !u.dead && heloTip.includes(u.type)).length;
    const kirmiziBaslangic = SIM.units.filter(u => u.isRed && !u.dead).length;
    const havaMenzili = (t) => { const s = STATS[t]; if (!s || !s.weapons) return 0;
        let r = 0; for (const w of s.weapons) if (Array.isArray(w.targets) && w.targets.includes('air')) r = Math.max(r, w.range||0);
        return r; };

    const ph = SIM.headless; SIM.headless = true; let st = 0;
    let heloOlum = 0, heloOlumDeger = 0, toplamOlumDeger = 0, dusurulenHelo = 0, sonSeq = -1;
    let hOrnek = 0, hMenzilde = 0, hGorunur = 0, hVurulabilir = 0;
    const bosalt = () => {
        if (typeof BATTLE_FORENSIC === 'undefined') return;
        for (const ev of BATTLE_FORENSIC.buf) {
            if (ev.seq <= sonSeq) continue; sonSeq = ev.seq;
            const dg = (STATS[ev.targetType] && STATS[ev.targetType].cost) || 0;
            if (ev.targetSide === 'red' && ev.lethal) {
                toplamOlumDeger += dg;
                if (heloTip.includes(ev.attackerType)) { heloOlum++; heloOlumDeger += dg; }
            } else if (ev.targetSide === 'blue' && ev.lethal && heloTip.includes(ev.targetType)) dusurulenHelo++;
        }
    };
    try {
        while (SIM.tick < 7300 && phase === PHASE.BATTLE) {
            st += BATTLE_TICK_MS;
            stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
            if (typeof updateSupport === 'function') updateSupport(BATTLE_TICK_SEC, st);
            if (SIM.tick % 10 !== 0) continue;
            bosalt();
            const canli = SIM.units.filter(u => !u.dead && !u.loaded && !u.abandoned);
            const kirmiziler = canli.filter(u => u.isRed);
            for (const h of canli) {
                if (h.isRed || !heloTip.includes(h.type)) continue;
                hOrnek++;
                let mIn = false, gIn = false;
                for (const a of kirmiziler) {
                    const d = Math.hypot(a.x - h.x, a.y - h.y);
                    if (!mIn && havaMenzili(a.type) > 0 && d <= havaMenzili(a.type)) mIn = true;
                    // GORUS: hava hedefini HERHANGI bir dost birim kendi vision'i icinde gorur
                    if (!gIn && d <= (STATS[a.type].vision || 0)) gIn = true;
                    if (mIn && gIn) break;
                }
                if (mIn) hMenzilde++;
                if (gIn) hGorunur++;
                if (mIn && gIn) hVurulabilir++;
            }
        }
    } finally { SIM.headless = ph; }
    bosalt();
    const oK = battleArmyObservation(true), oM = battleArmyObservation(false);
    return JSON.stringify({
        marj: Math.round(oK.effectiveValue - oM.effectiveValue),
        heloBaslangic, dusurulenHelo, heloOlum, heloOlumDeger, toplamOlumDeger,
        kirmiziBaslangic, kirmiziSon: SIM.units.filter(u => u.isRed && !u.dead).length,
        hOrnek, hMenzilde, hGorunur, hVurulabilir,
        bind: (typeof BATTLE_BALANCE !== 'undefined' ? (BATTLE_BALANCE.exploiterHeloBind||0) : 0),
        // KALDIRAC BAGLANMA SAYACI — 0 ise kaldirac HIC calismadi, tablo ANLAMSIZ (bugun bir kez yasandi)
        kBind: (typeof BATTLE_BALANCE === 'undefined') ? 0 :
            ((BATTLE_BALANCE.searchUncertainBind||0) + (BATTLE_BALANCE.adUmbrellaBind||0)),
        adAdet: SIM.units.filter(u => u.isRed && STATS[u.type] && STATS[u.type].category === 'air_defense').length
    });
})()`;
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'som.js' }));
}

yaz('SOMURUCU HAVUZ — kod-AI [' + BEYIN + '] (KIRMIZI) vs ' + SOMURU + ' (MAVI)');
yaz('  KIP: ' + KIP + (KIP === 'kaldirac' ? ('   KALDIRAC: ' + KALDIRAC + '  (bot HER IKI KOLDA acik)') : '   (bot kapali vs acik)'));
yaz('  ' + TOHUMLAR.length + ' tohum x 2 rol x 2 kol = ' + (TOHUMLAR.length * 4) + ' mac   (helo adedi ' + HELO_ADET + ')');
yaz('  HEDEF: somurucu, kullanicinin imzasini uretmeli — gercek maclarda helo kayiplarin %22 si');
yaz('');
const K = { kapali: [], acik: [] };
for (let i = 0; i < TOHUMLAR.length; i++) {
    for (const kS of [true, false]) {
        const a = kos(TOHUMLAR[i], kS, false), b = kos(TOHUMLAR[i], kS, true);
        K.kapali.push(a); K.acik.push(b);
        const pay = (r) => r.toplamOlumDeger ? Math.round(r.heloOlumDeger / r.toplamOlumDeger * 100) : 0;
        yaz('  [' + (i + 1) + '/' + TOHUMLAR.length + '] ' + TOHUMLAR[i] + ' ' + (kS ? 'SALD' : 'SAVU') +
            '  helo-pay ' + pay(a) + '% -> ' + pay(b) + '%   marj ' + a.marj + ' -> ' + b.marj + '   bind ' + b.bind);
        fs.writeFileSync(path.join(__dirname, '..', 'qa-runtime', 'somurucu-ARA.json'), JSON.stringify(K, null, 1));
    }
}
const ort = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const oranTop = (arr, p, q) => { const P = arr.reduce((s, r) => s + r[p], 0), Q = arr.reduce((s, r) => s + r[q], 0); return Q ? P / Q : 0; };
yaz('');
if (KIP === 'kaldirac') {
    yaz('  ══ KALDIRAC BAGLANMA ══  ' + KALDIRAC + ': ' + K.acik.reduce((s, r) => s + (r.kBind || 0), 0) +
        '  (bind>0 mac ' + K.acik.filter(r => (r.kBind || 0) > 0).length + '/' + K.acik.length + ')' +
        '   kontrol kolunda ' + K.kapali.reduce((s, r) => s + (r.kBind || 0), 0) + ' (0 olmali)' +
        '   |  AD adet ' + (K.kapali.reduce((s,r)=>s+(r.adAdet||0),0)/K.kapali.length).toFixed(1) +
        ' -> ' + (K.acik.reduce((s,r)=>s+(r.adAdet||0),0)/K.acik.length).toFixed(1));
}
yaz('  ══ SOMURUCU BAGLANMA ══  acik ' + K.acik.reduce((s, r) => s + r.bind, 0) +
    ' (bind>0 mac ' + K.acik.filter(r => r.bind > 0).length + '/' + K.acik.length + ')' +
    '   kapali ' + K.kapali.reduce((s, r) => s + r.bind, 0) + ' (0 olmali)');
yaz('');
yaz('  ' + 'metrik'.padEnd(36) + (KIP === 'kaldirac' ? 'KALDIRAC-' : 'BOT ').padStart(12) + (KIP === 'kaldirac' ? 'KALDIRAC+' : 'BOT ACIK').padStart(11) + 'gercek'.padStart(9));
const satir = (ad, f, gercek) => {
    yaz('  ' + ad.padEnd(36) + f(K.kapali).toFixed(1).padStart(12) + f(K.acik).toFixed(1).padStart(11) +
        (gercek == null ? '-' : String(gercek)).padStart(9));
};
satir('E2 helo kaynakli kayip payi %', arr => oranTop(arr, 'heloOlumDeger', 'toplamOlumDeger') * 100, 22);
satir('   helo oldurme (adet)', arr => ort(arr.map(r => r.heloOlum)), null);
satir('E3 dusurdugumuz helo', arr => ort(arr.map(r => r.dusurulenHelo)), null);
satir('   helo baslangic', arr => ort(arr.map(r => r.heloBaslangic)), null);
satir('E4 helo VURULABILIR %', arr => oranTop(arr, 'hVurulabilir', 'hOrnek') * 100, 34);
satir('   helo GORUNUR %', arr => oranTop(arr, 'hGorunur', 'hOrnek') * 100, 81);
satir('   helo MENZILDE %', arr => oranTop(arr, 'hMenzilde', 'hOrnek') * 100, 41);
satir('   kod-AI sagkalim %', arr => oranTop(arr, 'kirmiziSon', 'kirmiziBaslangic') * 100, null);
const fark = K.acik.map((b, i) => b.marj - K.kapali[i].marj);
const o = ort(fark), sd = Math.sqrt(fark.reduce((x, y) => x + (y - o) ** 2, 0) / Math.max(1, fark.length - 1));
const se = sd / Math.sqrt(fark.length);
yaz('');
yaz('  ══ E1 MARJ (bot acik − kapali; NEGATIF = somurucu ise yariyor) ══');
yaz('    ort ' + Math.round(o) + '   se ' + Math.round(se) + '   t ' + (se ? (o / se).toFixed(2) : '-'));
yaz('    kod-AI marji: bot kapali ' + Math.round(ort(K.kapali.map(r => r.marj))) +
    '  ->  bot acik ' + Math.round(ort(K.acik.map(r => r.marj))));
fs.writeFileSync(path.join(__dirname, '..', 'qa-runtime', 'somurucu-havuz.json'), JSON.stringify(K, null, 1));
