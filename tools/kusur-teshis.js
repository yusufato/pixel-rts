'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  KUSUR TEŞHİSİ — kullanıcının bildirdiği 5 muharebe kusuru için ÖLÇÜM aleti
//
//  Amaç: düzeltmeden ÖNCE her kusuru sayıya çevirmek. "Düzelttim" demek, aynı
//  senaryoda sayının değiştiğini göstermekle mümkün.
//
//    1  kamikaze paniklemesi        → panikleyen/kaçan drone tik sayısı
//    2  kamikaze çarpıp patlamıyor  → temasa giren drone / patlayan drone
//    3  SİHA hava-hava atamıyor     → SİHA'nın hava hedefe ikincil atışı
//    4  tank makinelisi havaya      → silahın hedef alanı + fiilî atış
//    5  boşuna sıkışma-manevrası    → manevra tetiği / gerçekten engel var mı
//
//  Senaryolar KURGULU (tam maç değil): kusur mekanizmasını izole eder, gürültü
//  düşük olur. 5 numara ise gerçek maçta ölçülür — sıkışma ancak kalabalıkta
//  ve arazi içinde anlam taşır.
//
//  Kullanım:  node tools/kusur-teshis.js [--mac 3]
// ═══════════════════════════════════════════════════════════════════════════
const path = require('node:path');
const vm = require('node:vm');
const { tezgahKur } = require('./muharebe-tezgah.js');

const MAC_SAYI = (() => {
    const i = process.argv.indexOf('--mac');
    return i >= 0 && process.argv[i + 1] ? Math.max(1, parseInt(process.argv[i + 1], 10) || 1) : 2;
})();

const { ctx, hatalar } = tezgahKur();
if (hatalar.length) { console.log('YUKLEME HATALARI:'); hatalar.forEach(h => console.log('  ' + h)); }

const calistir = kod => vm.runInContext('(() => {' + kod + '})()', ctx, { filename: 'kusur-teshis' });

// Kurgulu senaryo iskeleti: oturumu aç, sahayı BOŞALT, kendi birimlerini koy, tikle.
const SENARYO = `
/* SIRALAMA ONEMLI: ilk surumde birimleri temizleyip startBattle cagirmistim;
   startBattle bos sahada fazi 'deploy'da BIRAKIYOR, stepSim de muharebe
   mantigini hic calistirmiyordu -> her olcum sifir cikti ("kusur yok" gibi
   gorunuyordu, oysa alet oluydu). Dogru sira: oturum -> sahayi bosalt ->
   KENDI birimlerini koy -> startBattle. */
function _kur(seed) {
    openBattlefieldSession({ mode:'quick', mapId:-2, seed:seed, attackerSide:true,
        durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
    SIM.units.length = 0;
    return true;
}
function _basla() {
    startBattle();
    SIM.headless = true;
    if (phase !== PHASE.BATTLE) throw new Error('savas baslamadi, faz=' + phase);
    return true;
}
// T = __UNIT_LOAD.CONST (BUYUK-harf eski adlar). Roster string-id'leri __UNIT_LOAD.T'de.
function _tip(id) {
    const a = (typeof __UNIT_LOAD !== 'undefined' && __UNIT_LOAD.T) ? __UNIT_LOAD.T[id] : undefined;
    return a != null ? a : T[id];
}
function _koy(tipId, x, y, isRed) {
    const t = _tip(tipId);
    if (t == null) throw new Error('bilinmeyen tip: ' + tipId);
    const u = new Unit(t, 0, 0, isRed);
    u.x = x; u.y = y; u.hp = u.maxHp;
    u.targetX = x; u.targetY = y;
    SIM.units.push(u);
    return u;
}
function _tikle(n) {
    let st = SIM.tick * BATTLE_TICK_MS;
    for (let i = 0; i < n; i++) {
        st += BATTLE_TICK_MS;
        stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
        if (typeof updateSupport === 'function') updateSupport(BATTLE_TICK_SEC, st);
    }
}
`;

vm.runInContext(SENARYO, ctx, { filename: 'senaryo' });

// ── 1+2: KAMİKAZE panik + çarpma ────────────────────────────────────────────
// Drone'lar kalabalık bir düşman kütlesinin üstüne salınır. Kütle KASTEN büyük:
// panik kaynaklarının (sayıca dezavantaj, yoldaş kaybı, baskı) hepsi tetiklensin.
const kamikaze = calistir(`
    _kur(4242);
    const dusman = [];
    for (let i = 0; i < 10; i++) dusman.push(_koy('infantry', 2400 + (i % 5) * 60, 1600 + Math.floor(i / 5) * 60, true));
    for (let i = 0; i < 3; i++) dusman.push(_koy('mbt', 2400 + i * 90, 1760, true));
    const dronlar = [];
    for (let i = 0; i < 6; i++) {
        const d = _koy('loitering_munition', 2200 + i * 40, 1300, false);
        d.controlOwner = 'AI';
        dronlar.push(d);
    }
    _basla();
    const kimlik = dronlar.map(d => d.id);
    let panikTik = 0, kacTik = 0, enPanik = 0, temasEden = 0;
    const temasGoruldu = {};
    for (let adim = 0; adim < 400; adim++) {
        _tikle(1);
        for (const d of SIM.units) {
            if (!kimlik.includes(d.id) || d.dead) continue;
            if (d.isPanicking) panikTik++;
            if (d.isFleeing) kacTik++;
            if (d.panic > enPanik) enPanik = d.panic;
            // TEMAS: canli bir dusmanin 70px'ine girdi mi (patlama esigi)
            for (const o of SIM.units) {
                if (o.dead || o.isRed === d.isRed || o.isAir) continue;
                if (Math.hypot(o.x - d.x, o.y - d.y) <= 70) { temasGoruldu[d.id] = true; break; }
            }
        }
    }
    temasEden = Object.keys(temasGoruldu).length;
    const olen = kimlik.filter(id => { const u = SIM.units.find(z => z.id === id); return !u || u.dead; }).length;
    // Dusman kaybi = warhead gercekten patladi mi (tek kanit: hasar)
    const dusmanHp = dusman.reduce((s, u) => s + Math.max(0, u.hp), 0);
    const dusmanTamHp = dusman.reduce((s, u) => s + u.maxHp, 0);
    return {
        dron: kimlik.length, panikTik, kacTik, enPanik: Math.round(enPanik * 10) / 10,
        temasEden, olenDron: olen,
        dusmanKayipYuzde: Math.round((1 - dusmanHp / dusmanTamHp) * 1000) / 10,
        dusmanOlen: dusman.filter(u => u.dead).length
    };
`);

// ── 3: SİHA hava-hava ───────────────────────────────────────────────────────
const siha = calistir(`
    _kur(4243);
    const siha = _koy('armed_uav', 2400, 1400, false);
    siha.controlOwner = 'AI';
    const helo = _koy('attack_helo', 2400, 1750, true);   // 350px -> a2a menzili 600 icinde
    helo.controlOwner = 'AI';
    _basla();
    const hp0 = helo.hp, shp0 = siha.hp;
    /* HELO SABITLENIR. Ilk olcumde helo 1509px'e kacti ve SIHA'nin 600px'lik
       hava-hava menzilinden cikti -> "1 atis" cikmisti; bu silahin kusuru degil
       senaryonun kusuruydu. Menzil icinde tutunca silahin GERCEK atis hizi
       olculur. Ayrica her tik SIHA'nin cephanesi izlenip atis SAYILIR. */
    let a2aAtis = 0, oncekiCephane = siha.ammo, menzilIciTik = 0;
    for (let i = 0; i < 600; i++) {
        helo.x = 2400; helo.y = 1750; helo.targetX = helo.x; helo.targetY = helo.y;
        siha.x = 2400; siha.y = 1400; siha.targetX = siha.x; siha.targetY = siha.y;
        _tikle(1);
        if (Math.hypot(helo.x - siha.x, helo.y - siha.y) <= 600) menzilIciTik++;
        if (siha.ammo < oncekiCephane) a2aAtis++;
        oncekiCephane = siha.ammo;
        if (siha.dead || helo.dead) break;
    }
    return {
        a2aMenzil: STATS[_tip("armed_uav")].weapons[1] ? STATS[_tip("armed_uav")].weapons[1].range : null,
        a2aAktif: typeof weaponAktif === 'function' ? weaponAktif(STATS[_tip("armed_uav")].weapons[1]) : null,
        havaHavaAnahtar: typeof BATTLE_HAVA_HAVA !== 'undefined' ? BATTLE_HAVA_HAVA : null,
        sihaCephane: siha.ammo, sihaMaxCephane: siha.maxAmmo,
        a2aAtis, menzilIciTik,
        heloHasar: Math.round(hp0 - helo.hp), heloOldu: helo.dead,
        sihaHasar: Math.round(shp0 - siha.hp), sihaOldu: siha.dead,
        mesafe: Math.round(Math.hypot(helo.x - siha.x, helo.y - siha.y))
    };
`);

// ── 3b: SİHA'ya "şu helikoptere saldır" emri (oyuncunun gördüğü hâl) ────────
// Kritik kurgu: helo 800px'te. SİHA'nın `range`'i 900 (yer mühimmatı) ama
// hava-hava füzesi 600. Eski kod 900'ü "menzildeyim" sayıp DURDURUYOR, füze
// menziline hiç girmiyordu -> oyuncu "SİHA hava-hava atış yapamıyor" görüyor.
const siha2 = calistir(`
    _kur(4245);
    const siha = _koy('armed_uav', 2400, 1000, false);
    siha.controlOwner = 'PLAYER';
    const helo = _koy('attack_helo', 2400, 1800, true);   // 800px
    helo.controlOwner = 'AI';
    _basla();
    siha.manualTarget = helo;
    const hp0 = helo.hp;
    let enYakin = 1e9, a2aAtis = 0, onceki = siha.ammo;
    for (let i = 0; i < 900; i++) {
        helo.x = 2400; helo.y = 1800; helo.targetX = helo.x; helo.targetY = helo.y;  // helo sabit
        siha.manualTarget = helo;
        _tikle(1);
        const d = Math.hypot(helo.x - siha.x, helo.y - siha.y);
        if (d < enYakin) enYakin = d;
        if (siha.ammo < onceki) a2aAtis++;
        onceki = siha.ammo;
        if (siha.dead || helo.dead) break;
    }
    return {
        baslangicMesafe: 800, sihaRange: siha.range,
        a2aMenzil: STATS[_tip("armed_uav")].weapons[1].range,
        enYakinMesafe: Math.round(enYakin), a2aAtis,
        heloHasar: Math.round(hp0 - Math.max(0, helo.hp)), heloOldu: helo.dead, sihaOldu: siha.dead
    };
`);

// ── 4: TANK makinelisi havaya ───────────────────────────────────────────────
const tank = calistir(`
    _kur(4244);
    const mbt = _koy('mbt', 2400, 1400, false);
    mbt.controlOwner = 'AI';
    const dron = _koy('loitering_munition', 2400, 1500, true);   // 100px, makineli menzili 450
    dron.controlOwner = 'AI';
    const helo = _koy('attack_helo', 2700, 1400, true);          // 300px
    helo.controlOwner = 'AI';
    _basla();
    const dHp0 = dron.hp, hHp0 = helo.hp;
    /* HELO SABITLENIR: ilk olcumde AI helosu ucup makinelinin 300px'lik hava
       menzilinden cikiyor, "heloHasar 0" cikip duzeltme calismiyor sanilyordu. */
    for (let i = 0; i < 300; i++) {
        helo.x = 2650; helo.y = 1400; helo.targetX = helo.x; helo.targetY = helo.y;
        mbt.x = 2400; mbt.y = 1400; mbt.targetX = mbt.x; mbt.targetY = mbt.y;
        _tikle(1);
        if (helo.dead) break;
    }
    const heloMesafe = Math.round(Math.hypot(helo.x - mbt.x, helo.y - mbt.y));
    const mg = STATS[_tip("mbt")].weapons[1];
    return {
        makineliHedef: mg.targets, makineliMenzil: mg.range, makineliTip: mg.damageType,
        droneVurabilir: typeof unitCanEngage === 'function' ? unitCanEngage(STATS[_tip("mbt")], STATS[_tip("loitering_munition")]) : null,
        heloVurabilir: typeof unitCanEngage === 'function' ? unitCanEngage(STATS[_tip("mbt")], STATS[_tip("attack_helo")]) : null,
        droneHasar: Math.round(dHp0 - Math.max(0, dron.hp)), droneOldu: dron.dead,
        heloHasar: Math.round(hHp0 - Math.max(0, helo.hp)), heloOldu: helo.dead, heloMesafe
    };
`);

console.log('');
console.log('╔══ 1+2  KAMİKAZE: panik + çarpma ═══════════════════════════════════');
console.log('║ ' + JSON.stringify(kamikaze));
console.log('╔══ 3    SİHA hava-hava ═════════════════════════════════════════════');
console.log('║ ' + JSON.stringify(siha));
console.log('╔══ 3b   SİHA: "şu helikoptere saldır" emri ═════════════════════════');
console.log('║ ' + JSON.stringify(siha2));
console.log('╔══ 4    TANK makinelisi → hava ═════════════════════════════════════');
console.log('║ ' + JSON.stringify(tank));

// ── 5: SIKIŞMA MANEVRASI boşuna mı tetikleniyor? (gerçek maç) ───────────────
// Kurgulu senaryo yetmez: manevra kalabalık + arazi ister. Motora eklenen
// sayaç (SIM._unstickSayac) her tetikte "önümde gerçekten engel var mıydı"yı
// kaydeder; burada yalnız toplanır.
let unstick = null;
try {
    unstick = calistir(`
        const toplam = { tetik: 0, engelVar: 0, engelYok: 0, arazi: 0, birim: 0, iptal: 0 };
        for (let m = 0; m < ${MAC_SAYI}; m++) {
            openBattlefieldSession({ mode:'quick', mapId:-2, seed:5000 + m, attackerSide:true,
                durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
            const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false });
            battleDeployManifest(mv, false, { source:'teshis', ally:true });
            startBattle();
            SIM.headless = true;
            SIM._unstickSayac = { tetik:0, engelVar:0, engelYok:0, arazi:0, birim:0, iptal:0 };
            if (m === 0) SIM._silahSayac = {};   // ikincil-silah atis sayaci (SIHA hava-hava dahil)
            let st = 0;
            while (SIM.tick < 3000 && phase === PHASE.BATTLE) {
                st += BATTLE_TICK_MS;
                stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
            }
            for (const k in toplam) toplam[k] += SIM._unstickSayac[k] || 0;
        }
        toplam.bosYuzde = toplam.tetik ? Math.round(toplam.engelYok / toplam.tetik * 1000) / 10 : 0;
        toplam.ikincilSilahAtis = SIM._silahSayac || null;
        /* SIFIR ATIS TEK BASINA KANIT DEGIL: o maclarda hic hava birimi yoksa
           hava-hava atisinin sifir olmasi beklenir. Kompozisyon sayilmadan
           "hava-hava calismiyor" denemez. */
        const kompozisyon = {};
        for (const u of SIM.units) {
            const id = (STATS[u.type] && STATS[u.type].id) || u.type;
            kompozisyon[id] = (kompozisyon[id] || 0) + 1;
        }
        toplam.sonMacHavaBirimleri = {
            armed_uav: kompozisyon.armed_uav || 0, attack_helo: kompozisyon.attack_helo || 0,
            recon_uav: kompozisyon.recon_uav || 0, transport_helo: kompozisyon.transport_helo || 0,
            loitering_munition: kompozisyon.loitering_munition || 0
        };
        return toplam;
    `);
} catch (e) { unstick = { hata: String(e.message).slice(0, 160) }; }

console.log('╔══ 5    SIKIŞMA manevrası (gerçek maç ×' + MAC_SAYI + ') ═══════════════════');
console.log('║ ' + JSON.stringify(unstick));
console.log('');
